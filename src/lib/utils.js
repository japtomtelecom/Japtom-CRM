'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { construirMensaje, linkWhatsApp } from '@/lib/utils';

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
  const [clientesMap, setClientesMap] = useState({});
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      setLoading(true);

      const [{ data: registro, error: errRegistro }, { data: clientesData, error: errClientes }, { data: configData }] =
        await Promise.all([
          supabase.from('v_registro_pagos_mensual').select('*').order('nombre').order('periodo'),
          supabase
            .from('v_clientes_estado')
            .select('id, codigo, nombre, telefono, activo, estado, plan, precio, dia_pago'),
          supabase.from('config').select('*'),
        ]);

      if (errRegistro) console.error('Error al cargar v_registro_pagos_mensual:', errRegistro);
      if (errClientes) console.error('Error al cargar v_clientes_estado:', errClientes);

      setRows(registro || []);

      const map = {};
      (clientesData || []).forEach((c) => (map[c.id] = c));
      setClientesMap(map);

      const cfg = {};
      (configData || []).forEach((r) => (cfg[r.clave] = r.valor));
      setConfig(cfg);

      setLoading(false);
    }
    cargar();
  }, []);

  function irARegistrarPago(cliente_id, periodo) {
    const mes = periodo.slice(0, 7); // yyyy-mm-01 -> yyyy-mm
    router.push(`/pagos?cliente_id=${cliente_id}&mes=${mes}`);
  }

  async function marcarMensajeEnviado(clienteId) {
    await supabase.from('clientes').update({ ultimo_mensaje_enviado: new Date().toISOString() }).eq('id', clienteId);
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
                  <th className="py-2 pr-2 sticky left-0 bg-white"></th>
                  <th className="py-2 pr-4 sticky left-0 bg-white">Cliente</th>
                  {periodos.map((p) => (
                    <th key={p} className="py-2 px-2 text-center whitespace-nowrap">
                      {formatPeriodoCorto(p)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nombres.map((nombre) => {
                  const primeraFila = rows.find((r) => r.nombre === nombre);
                  const cliente = clientesMap[primeraFila?.cliente_id];
                  const mensaje = cliente ? construirMensaje(cliente, config, config.empresa_nombre) : '';
                  const wa = cliente ? linkWhatsApp(cliente.telefono, mensaje) : null;

                  return (
                    <tr key={nombre} className="border-b border-brand-50">
                      <td className="py-2 pr-2 sticky left-0 bg-white">
                        {wa && (
                          
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => marcarMensajeEnviado(cliente.id)}
                            title={`Enviar WhatsApp a ${nombre}`}
                            style={{ fontSize: 16, textDecoration: 'none' }}
                          >
                            📲
                          </a>
                        )}
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}