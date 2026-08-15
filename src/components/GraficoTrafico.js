'use client';

import { useEffect, useRef, useState } from 'react';
import { llamarApiAdmin } from '@/lib/llamarApiAdmin';

const MAX_PUNTOS = 30;

function formatMbps(bps) {
  return (bps / 1_000_000).toFixed(1);
}

// Gráfico de línea de tráfico en tiempo real. Se conecta a un endpoint de
// administrador (que ya devuelve rxBps/txBps calculados por el MikroTik) y
// va agregando un punto nuevo cada `intervaloMs`, dibujando un SVG simple
// (sin librerías externas, para no depender de instalar nada nuevo).
//
// - endpoint: ruta completa, ej. "/api/mikrotik/trafico-router"
// - body: objeto que se manda en cada llamada, ej. { ciudad: 'Tarija' }
// Cuántas veces seguidas tiene que fallar la consulta antes de mostrar el
// error a pantalla completa. Una sola consulta que falla (un hipo de un
// segundo de conexión con el MikroTik, algo normal en una red real) no
// alcanza para tapar todo el gráfico — recién se avisa si falla varias
// veces seguidas, que ahí sí es una señal de que algo dejó de funcionar de
// verdad.
const FALLOS_PARA_AVISAR = 3;

export default function GraficoTrafico({ titulo, endpoint, body, intervaloMs = 3000 }) {
  const [puntos, setPuntos] = useState([]);
  const [estado, setEstado] = useState('cargando'); // cargando | ok | offline | sin-datos | error
  const [error, setError] = useState('');
  const [avisoTransitorio, setAvisoTransitorio] = useState(false);
  const timerRef = useRef(null);
  const activoRef = useRef(true);
  const fallosRef = useRef(0);
  const bodyKey = JSON.stringify(body);

  useEffect(() => {
    activoRef.current = true;
    fallosRef.current = 0;
    setPuntos([]);
    setEstado('cargando');
    setAvisoTransitorio(false);

    async function tick() {
      try {
        const json = await llamarApiAdmin(endpoint, body);
        if (!activoRef.current) return;

        fallosRef.current = 0;
        setAvisoTransitorio(false);

        if (json.online === false) {
          setEstado('offline');
          setPuntos([]);
        } else if (json.sinInterfaz) {
          setEstado('sin-datos');
        } else {
          setEstado('ok');
          setPuntos((prev) => {
            const next = [...prev, { rx: json.rxBps || 0, tx: json.txBps || 0 }];
            return next.length > MAX_PUNTOS ? next.slice(next.length - MAX_PUNTOS) : next;
          });
        }
      } catch (e) {
        if (!activoRef.current) return;
        fallosRef.current += 1;
        if (fallosRef.current >= FALLOS_PARA_AVISAR) {
          setEstado('error');
          setError(e.message);
        } else {
          // Falla puntual: no se borra el gráfico que ya se venía
          // mostrando, solo se avisa chiquito que hubo un hipo.
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
  }, [endpoint, bodyKey, intervaloMs]);

  const max = Math.max(1, ...puntos.map((p) => Math.max(p.rx, p.tx)));
  const ultimo = puntos.length ? puntos[puntos.length - 1] : { rx: 0, tx: 0 };

  function trazo(campo) {
    if (puntos.length < 2) return '';
    return puntos
      .map((p, i) => {
        const x = (i / (MAX_PUNTOS - 1)) * 100;
        const y = 100 - (p[campo] / max) * 100;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-brand-700 mb-3">{titulo}</h2>

      {estado === 'cargando' && puntos.length === 0 && (
        <p className="text-sm text-brand-400">Consultando…</p>
      )}
      {estado === 'offline' && (
        <p className="text-sm text-brand-400">El cliente no tiene una sesión activa en este momento.</p>
      )}
      {estado === 'sin-datos' && (
        <p className="text-sm text-brand-400">Está conectado, pero todavía no se pudo identificar su interfaz en el MikroTik.</p>
      )}
      {estado === 'error' && <p className="text-sm text-red-600">⚠️ {error}</p>}

      {(estado === 'ok' || (estado === 'cargando' && puntos.length > 0)) && (
        <>
          <div className="flex gap-6 mb-3">
            <div>
              <p className="text-xs text-brand-400">⬇️ Bajada</p>
              <p className="text-xl font-semibold" style={{ color: '#085041' }}>
                {formatMbps(ultimo.rx)} Mbps
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-400">⬆️ Subida</p>
              <p className="text-xl font-semibold" style={{ color: '#8a6d00' }}>
                {formatMbps(ultimo.tx)} Mbps
              </p>
            </div>
          </div>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: '100%', height: 140, background: '#F5F7F6', borderRadius: 8 }}
          >
            <path d={trazo('rx')} fill="none" stroke="#085041" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d={trazo('tx')} fill="none" stroke="#8a6d00" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="text-xs text-brand-400 mt-2">
            🟢 Bajada · 🟡 Subida — se actualiza solo cada {Math.round(intervaloMs / 1000)}s
            {avisoTransitorio && ' · ⚠️ hipo de conexión, reintentando…'}
          </p>
        </>
      )}
    </div>
  );
}
