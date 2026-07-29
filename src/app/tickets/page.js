'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { generarTicketFalla } from '@/lib/generarTicket';

export default function TicketsPage() {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [empresaNombre, setEmpresaNombre] = useState('JapTom Telecom');
  const [generando, setGenerando] = useState(false);

  async function buscar(q) {
    setBusqueda(q);
    setSeleccionado(null);
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    // Busca en AMBAS ciudades a propósito (sin filtrar por sucursal) —
    // esta pantalla es una herramienta transversal para soporte técnico.
    const { data } = await supabase
      .from('clientes')
      .select('id, codigo, nombre, telefono, direccion, plan, ciudad')
      .ilike('nombre', `%${q}%`)
      .limit(10);
    setResultados(data || []);

    if (!empresaNombre) {
      const { data: cfg } = await supabase.from('config').select('valor').eq('clave', 'empresa_nombre').single();
      if (cfg?.valor) setEmpresaNombre(cfg.valor);
    }
  }

  async function generar() {
    if (!seleccionado) return;
    if (!confirm(`¿Confirmas generar el ticket de falla para ${seleccionado.nombre}?`)) return;
    setGenerando(true);
    try {
      await generarTicketFalla(seleccionado, motivo, empresaNombre);
      setMotivo('');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold text-brand-800 mb-1">Tickets de falla</h1>
      <p className="text-brand-500 mb-6">
        Busca a cualquier cliente — de El Alto o de Tarija — y genera su ticket de falla en PDF.
      </p>

      <div className="card p-6 max-w-lg space-y-4">
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

        <button onClick={generar} disabled={!seleccionado || generando} className="btn-primary w-full">
          {generando ? 'Generando…' : '📄 Descargar PDF'}
        </button>
      </div>
    </AppShell>
  );
}
