'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { generarTicketFalla } from '@/lib/generarTicket';

// --- Helpers de fecha/hora (siempre en hora de Bolivia, UTC-4 fijo) ----
// Mismo criterio que en /fallas: Bolivia no tiene horario de verano, así
// que el offset es siempre -04:00, sin depender del reloj del dispositivo.
const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function partesDesdeIso(iso) {
  const d = iso ? new Date(iso) : new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const partes = {};
  fmt.formatToParts(d).forEach((p) => {
    partes[p.type] = p.value;
  });
  let minuto = Math.round(Number(partes.minute) / 5) * 5;
  let hora = Number(partes.hour);
  if (minuto === 60) {
    minuto = 0;
    hora = (hora + 1) % 24;
  }
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: String(hora).padStart(2, '0'),
    minuto: String(minuto).padStart(2, '0'),
  };
}

function partesAIso(fecha, hora, minuto) {
  return new Date(`${fecha}T${hora}:${minuto}:00-04:00`).toISOString();
}

function SelectorFechaHora({ label, fecha, hora, minuto, onCambiarFecha, onCambiarHora, onCambiarMinuto }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input
          type="date"
          className="input"
          value={fecha}
          onChange={(e) => onCambiarFecha(e.target.value)}
          style={{ flex: 2 }}
        />
        <select className="input" value={hora} onChange={(e) => onCambiarHora(e.target.value)} style={{ flex: 1 }}>
          {HORAS.map((h) => (
            <option key={h} value={h}>
              {h} h
            </option>
          ))}
        </select>
        <select className="input" value={minuto} onChange={(e) => onCambiarMinuto(e.target.value)} style={{ flex: 1 }}>
          {MINUTOS.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const { user } = useAuth();
  const [ciudadFiltro, setCiudadFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [empresaNombre, setEmpresaNombre] = useState('JapTom Telecom');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);

  const inicial = partesDesdeIso();
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState(inicial.hora);
  const [minuto, setMinuto] = useState(inicial.minuto);

  async function buscar(q, ciudad = ciudadFiltro) {
    setBusqueda(q);
    setSeleccionado(null);
    setGuardado(false);
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    let query = supabase
      .from('clientes')
      .select('id, codigo, nombre, telefono, direccion, plan, ciudad')
      .ilike('nombre', `%${q}%`)
      .limit(10);
    // Si hay una ciudad elegida (no "todas"), se restringe la búsqueda a esa
    // sucursal — así no aparece por error un cliente de la otra ciudad.
    if (ciudad !== 'todas') query = query.eq('ciudad', ciudad);
    const { data } = await query;
    setResultados(data || []);

    if (!empresaNombre) {
      const { data: cfg } = await supabase.from('config').select('valor').eq('clave', 'empresa_nombre').single();
      if (cfg?.valor) setEmpresaNombre(cfg.valor);
    }
  }

  function cambiarCiudad(ciudad) {
    setCiudadFiltro(ciudad);
    setSeleccionado(null);
    setGuardado(false);
    // Si ya había algo escrito en el buscador, se re-ejecuta la búsqueda
    // con la nueva ciudad, para no dejar resultados de la ciudad anterior.
    if (busqueda.trim().length >= 2) buscar(busqueda, ciudad);
    else setResultados([]);
  }

  // Guarda el ticket en tickets_falla (mismo comportamiento que "Historial
  // de fallas" en la ficha del cliente y que la página "Fallas") y además
  // descarga el PDF. Al quedar en tickets_falla, el ticket aparece
  // automáticamente en /fallas (con fecha de apertura, y ahí mismo se
  // puede cerrar eligiendo fecha/hora de cierre y la resolución) y en el
  // historial de fallas de la ficha del cliente.
  async function generar() {
    if (!seleccionado) return;
    if (!confirm(`¿Confirmas generar el ticket de falla para ${seleccionado.nombre}?`)) return;
    setGenerando(true);
    setError('');
    setGuardado(false);
    try {
      const { error: err } = await supabase.from('tickets_falla').insert({
        tipo: 'individual',
        cliente_id: seleccionado.id,
        ciudad: seleccionado.ciudad || 'El Alto',
        descripcion: motivo.trim() || 'Ticket de falla generado desde Tickets',
        creado_por: user?.email || null,
        creado_en: partesAIso(fecha, hora, minuto),
      });
      if (err) {
        setError('Error al guardar el ticket en el historial: ' + err.message);
        return;
      }

      await generarTicketFalla(seleccionado, motivo, empresaNombre);
      setGuardado(true);
      setMotivo('');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold text-brand-800 mb-1">Tickets de falla</h1>
      <p className="text-brand-500 mb-6">
        Busca a cualquier cliente — de El Alto o de Tarija — y genera su ticket de falla en PDF. El ticket queda
        guardado en el historial del cliente y en{' '}
        <Link href="/fallas" className="hover:underline">
          Fallas
        </Link>
        , donde luego lo puedes cerrar con fecha, hora y solución.
      </p>

      <div className="card p-6 max-w-lg space-y-4">
        <div>
          <label className="label">Ciudad</label>
          <select className="input" value={ciudadFiltro} onChange={(e) => cambiarCiudad(e.target.value)}>
            <option value="todas">Todas las ciudades</option>
            <option value="El Alto">El Alto</option>
            <option value="Tarija">Tarija</option>
          </select>
        </div>

        <div>
          <label className="label">Buscar cliente</label>
          <input
            className="input"
            placeholder="Nombre del cliente…"
            value={busqueda}
            onChange={(e) => buscar(e.target.value)}
          />
          {resultados.length > 0 && !seleccionado && (
            <div className="border border-brand-100 rounded-lg mt-1 max-h-56 overflow-y-auto">
              {resultados.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSeleccionado(c);
                    setBusqueda(c.nombre);
                    setResultados([]);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-brand-50"
                >
                  {c.nombre}{' '}
                  <span className="text-brand-400 font-mono text-xs">
                    ({c.codigo} · {c.ciudad || 'El Alto'})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {seleccionado && (
          <div className="bg-brand-50 rounded-lg p-3 text-sm space-y-1">
            <div>
              <strong>Cliente:</strong> {seleccionado.nombre} ({seleccionado.codigo})
            </div>
            <div>
              <strong>Sucursal:</strong> {seleccionado.ciudad || 'El Alto'}
            </div>
            <div>
              <strong>Teléfono:</strong> {seleccionado.telefono || '—'}
            </div>
            <div>
              <strong>Dirección:</strong> {seleccionado.direccion || '—'}
            </div>
          </div>
        )}

        <SelectorFechaHora
          label="Fecha y hora de apertura"
          fecha={fecha}
          hora={hora}
          minuto={minuto}
          onCambiarFecha={setFecha}
          onCambiarHora={setHora}
          onCambiarMinuto={setMinuto}
        />

        <div>
          <label className="label">Motivo de la falla</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Ej: Cliente reporta intermitencia en la señal…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        {error && <p className="text-sm" style={{ color: '#791F1F' }}>{error}</p>}
        {guardado && (
          <p className="text-sm" style={{ color: '#085041' }}>
            ✅ Ticket guardado y PDF descargado. Puedes cerrarlo luego desde{' '}
            <Link href="/fallas" className="hover:underline">
              Fallas
            </Link>
            .
          </p>
        )}

        <button onClick={generar} disabled={!seleccionado || generando} className="btn-primary w-full">
          {generando ? 'Generando…' : '📄 Generar y guardar ticket'}
        </button>
      </div>
    </AppShell>
  );
}
