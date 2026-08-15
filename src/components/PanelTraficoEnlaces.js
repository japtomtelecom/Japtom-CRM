'use client';

import { useEffect, useRef, useState } from 'react';
import { llamarApiAdmin } from '@/lib/llamarApiAdmin';

const MAX_PUNTOS = 30;
const FALLOS_PARA_AVISAR = 3;

function formatMbps(bps) {
  return (bps / 1_000_000).toFixed(1);
}

function trazo(puntos, campo, max) {
  if (puntos.length < 2) return '';
  return puntos
    .map((p, i) => {
      const x = (i / (MAX_PUNTOS - 1)) * 100;
      const y = 100 - (p[campo] / max) * 100;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function GraficoEnlace({ nombre, puntos, error }) {
  const max = Math.max(1, ...puntos.map((p) => Math.max(p.rx, p.tx)));
  const ultimo = puntos.length ? puntos[puntos.length - 1] : { rx: 0, tx: 0 };

  return (
    <div>
      <p className="text-sm font-semibold text-brand-700 mb-1">{nombre}</p>
      {error ? (
        <p className="text-xs text-red-600">⚠️ {error}</p>
      ) : (
        <>
          <div className="flex gap-4 mb-2">
            <span className="text-xs" style={{ color: '#085041' }}>
              ⬇️ {formatMbps(ultimo.rx)} Mbps
            </span>
            <span className="text-xs" style={{ color: '#8a6d00' }}>
              ⬆️ {formatMbps(ultimo.tx)} Mbps
            </span>
          </div>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: '100%', height: 100, background: '#F5F7F6', borderRadius: 8 }}
          >
            <path d={trazo(puntos, 'rx', max)} fill="none" stroke="#085041" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d={trazo(puntos, 'tx', max)} fill="none" stroke="#8a6d00" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </>
      )}
    </div>
  );
}

// Panel con un gráfico chico por cada enlace de internet de una sede,
// cuando hay más de un proveedor (ej. El Alto: COMTECO + ENTEL). Pensado
// para ir en el Dashboard.
export default function PanelTraficoEnlaces({ titulo, ciudad, intervaloMs = 4000 }) {
  const [porEnlace, setPorEnlace] = useState({}); // { nombre: { puntos: [...], error } }
  const [estado, setEstado] = useState('cargando'); // cargando | ok | error
  const [error, setError] = useState('');
  const [avisoTransitorio, setAvisoTransitorio] = useState(false);
  const timerRef = useRef(null);
  const activoRef = useRef(true);
  const fallosRef = useRef(0);

  useEffect(() => {
    activoRef.current = true;
    fallosRef.current = 0;
    setPorEnlace({});
    setEstado('cargando');
    setAvisoTransitorio(false);

    async function tick() {
      try {
        const json = await llamarApiAdmin('/api/mikrotik/trafico-enlaces', { ciudad });
        if (!activoRef.current) return;
        fallosRef.current = 0;
        setAvisoTransitorio(false);
        setEstado('ok');
        setPorEnlace((prev) => {
          const next = { ...prev };
          (json.enlaces || []).forEach((e) => {
            const anterior = next[e.nombre] || { puntos: [] };
            if (e.error) {
              next[e.nombre] = { puntos: anterior.puntos, error: e.error };
              return;
            }
            const nuevos = [...anterior.puntos, { rx: e.rxBps || 0, tx: e.txBps || 0 }];
            next[e.nombre] = {
              puntos: nuevos.length > MAX_PUNTOS ? nuevos.slice(nuevos.length - MAX_PUNTOS) : nuevos,
              error: null,
            };
          });
          return next;
        });
      } catch (e) {
        if (!activoRef.current) return;
        fallosRef.current += 1;
        if (fallosRef.current >= FALLOS_PARA_AVISAR) {
          setEstado('error');
          setError(e.message);
        } else {
          setAvisoTransitorio(true);
        }
      } finally {
        if (activoRef.current) timerRef.current = setTimeout(tick, intervaloMs);
      }
    }

    tick();
    return () => {
      activoRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciudad, intervaloMs]);

  const nombres = Object.keys(porEnlace);

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-brand-700 mb-3">{titulo}</h2>

      {estado === 'cargando' && nombres.length === 0 && <p className="text-sm text-brand-400">Consultando…</p>}
      {estado === 'error' && <p className="text-sm text-red-600">⚠️ {error}</p>}

      {nombres.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {nombres.map((nombre) => (
            <GraficoEnlace key={nombre} nombre={nombre} puntos={porEnlace[nombre].puntos} error={porEnlace[nombre].error} />
          ))}
        </div>
      )}

      {nombres.length > 0 && (
        <p className="text-xs text-brand-400 mt-3">
          🟢 Bajada · 🟡 Subida — se actualiza solo cada {Math.round(intervaloMs / 1000)}s
          {avisoTransitorio && ' · ⚠️ hipo de conexión, reintentando…'}
        </p>
      )}
    </div>
  );
}
