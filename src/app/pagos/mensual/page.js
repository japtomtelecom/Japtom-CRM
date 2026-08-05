'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';

const STATUS_STYLE = {
  pagado: { bg: '#E1F5EE', text: '#085041', icon: '✓', label: 'Pagado' },
  no_vencido: { bg: '#F1EFE8', text: '#5F5E5A', icon: '', label: 'Aún no vence' },
  por_vencer: { bg: '#FAEEDA', text: '#854F0B', icon: '!', label: 'Vencido (1-5 días)' },
  vencido: { bg: '#FCEBEB', text: '#791F1F', icon: '✕', label: 'Vencido (+5 días)' },
};

function formatPeriodoCorto(periodo) {
const d = new Date(periodo.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' });
}

export default function RegistroMensualPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_registro_pagos_mensual')
        .select('*')
        .order('nombre')
        .order('periodo');
      if (error) console.error('Error al cargar v_registro_pagos_mensual:', error);
      setRows(data || []);
      setLoading(false);
    }
    cargar();
  }, []);

  function irARegistrarPago(cliente_id, periodo) {
    const mes = periodo.slice(0, 7); // yyyy-mm-01 -> yyyy-mm
    router.push(`/pagos?cliente_id=${cliente_id}&mes=${mes}`);
  }

  const nombres = [...new Set(rows.map((r) => r.nombre))];
  const periodos = [...new Set(rows.map((r) => r.periodo))].sort();

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold text-brand-800 mb-6">Registro mensual</h1>

      <div className="card p-5">
        <div className="flex gap-4 text-xs mb-4 flex-wrap">
          {Object.entries(STATUS_STYLE).map(([key, s]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: s.bg,
                  border: `1px solid ${s.text}`,
                  display: 'inline-block',
                }}
              />
              {s.label}
            </span>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-brand-400">Cargando registro...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 border-b border-brand-100">
                  <th className="py-2 pr-4 sticky left-0 bg-white">Cliente</th>
                  {periodos.map((p) => (
                    <th key={p} className="py-2 px-2 text-center whitespace-nowrap">
                      {formatPeriodoCorto(p)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nombres.map((nombre) => (
                  <tr key={nombre} className="border-b border-brand-50">
                    <td className="py-2 pr-4 whitespace-nowrap sticky left-0 bg-white">{nombre}</td>
                    {periodos.map((p) => {
                      const cell = rows.find((r) => r.nombre === nombre && r.periodo === p);
                      if (!cell) return <td key={p} />;
                      const style = STATUS_STYLE[cell.status];
                      return (
                        <td key={p} className="py-1 px-2 text-center">
                          <button
                            type="button"
                            title={`${formatPeriodoCorto(p)} · ${style.label}`}
                            onClick={() => cell.status !== 'pagado' && irARegistrarPago(cell.cliente_id, cell.periodo)}
                            style={{
                              width: 30,
                              height: 26,
                              background: style.bg,
                              color: style.text,
                              border: 'none',
                              borderRadius: 6,
                              fontWeight: 600,
                              cursor: cell.status !== 'pagado' ? 'pointer' : 'default',
                            }}
                          >
                            {style.icon}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}