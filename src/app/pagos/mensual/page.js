'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
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

// Suma n meses a un mes 'YYYY-MM' y devuelve 'YYYY-MM' (sin usar Date, para
// evitar corrimientos por zona horaria).
function sumarMeses(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

// Texto corto para mostrar bajo el ✓: el día del pago ("12") o, si el pago se
// hizo en otro mes distinto al período (adelantado o atrasado), día/mes ("28/9").
function diaPagoCorto(fechaPago, periodo) {
  const dia = Number(fechaPago.slice(8, 10));
  const mesPago = fechaPago.slice(0, 7);
  return mesPago === periodo.slice(0, 7) ? String(dia) : `${dia}/${Number(fechaPago.slice(5, 7))}`;
}

export default function RegistroMensualPage() {
  const router = useRouter();
  const { sucursalActiva } = useSucursalActiva();
  const [rowsTodas, setRowsTodas] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [config, setConfig] = useState({});
  const [pagosPorMes, setPagosPorMes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

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

      setRowsTodas(registro || []);

      // Fecha del pago que cubre cada mes de cada cliente. Se trae por tandas de
      // 1000 porque Supabase corta las consultas en ese límite.
      const pagos = [];
      for (let desde = 0; ; desde += 1000) {
        const { data: tanda, error: errPagos } = await supabase
          .from('pagos')
          .select('cliente_id, fecha_pago, mes_corresponde, meses_cubiertos')
          .order('fecha_pago', { ascending: true })
          .range(desde, desde + 999);
        if (errPagos) {
          console.error('Error al cargar pagos:', errPagos);
          break;
        }
        pagos.push(...(tanda || []));
        if (!tanda || tanda.length < 1000) break;
      }

      // Pagos ordenados por fecha: si dos pagos cubren el mismo mes, queda el más reciente.
      const porMes = {};
      pagos.forEach((pg) => {
        const n = pg.meses_cubiertos ?? 1;
        if (n <= 0 || !pg.fecha_pago) return; // costo de instalación: no cubre ningún mes
        const inicio = (pg.mes_corresponde || pg.fecha_pago).slice(0, 7);
        for (let i = 0; i < n; i++) {
          porMes[`${pg.cliente_id}|${sumarMeses(inicio, i)}`] = pg.fecha_pago;
        }
      });
      setPagosPorMes(porMes);

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

  const rowsPorSucursal =
    !sucursalActiva || sucursalActiva === 'Todas'
      ? rowsTodas
      : rowsTodas.filter((r) => r.ciudad === sucursalActiva);

  // Aplica el buscador (por nombre o por código)
  const q = busqueda.trim().toLowerCase();
  const rows = q
    ? rowsPorSucursal.filter((r) => {
        const codigo = clientesMap[r.cliente_id]?.codigo || '';
        return r.nombre.toLowerCase().includes(q) || codigo.toLowerCase().includes(q);
      })
    : rowsPorSucursal;

  function irARegistrarPago(cliente_id, periodo) {
    const mes = periodo.slice(0, 7);
    router.push(`/pagos?cliente_id=${cliente_id}&mes=${mes}`);
  }

  async function marcarMensajeEnviado(clienteId) {
    await supabase.from('clientes').update({ ultimo_mensaje_enviado: new Date().toISOString() }).eq('id', clienteId);
  }

  // Lista de clientes únicos, ordenada por código
  const clientesUnicos = [...new Map(rows.map((r) => [r.cliente_id, r.nombre])).keys()]
    .map((cliente_id) => ({
      cliente_id,
      nombre: rows.find((r) => r.cliente_id === cliente_id)?.nombre,
      codigo: clientesMap[cliente_id]?.codigo || '',
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const periodos = [...new Set(rows.map((r) => r.periodo))].sort();

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold text-brand-800 mb-6">Registro mensual</h1>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-4 text-xs flex-wrap">
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
          <input
            className="input md:max-w-xs"
            placeholder="Buscar por nombre o ID…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-brand-400">Cargando registro...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 border-b border-brand-100">
                  <th className="py-2 pr-2 sticky left-0 bg-white"></th>
                  <th className="py-2 pr-3 sticky left-0 bg-white">ID</th>
                  <th className="py-2 pr-4 sticky left-0 bg-white">Cliente</th>
                  {periodos.map((p) => (
                    <th key={p} className="py-2 px-2 text-center whitespace-nowrap">
                      {formatPeriodoCorto(p)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientesUnicos.map(({ cliente_id, nombre, codigo }) => {
                  const cliente = clientesMap[cliente_id];
                  const mensaje = cliente ? construirMensaje(cliente, config, config.empresa_nombre) : '';
                  const wa = cliente ? linkWhatsApp(cliente.telefono, mensaje) : null;

                  return (
                    <tr key={cliente_id} className="border-b border-brand-50">
                      <td className="py-2 pr-2 sticky left-0 bg-white">
                        {wa && (
                          <a href={wa} target="_blank" rel="noreferrer" onClick={() => marcarMensajeEnviado(cliente.id)} title={`Enviar WhatsApp a ${nombre}`} style={{ fontSize: 16, textDecoration: 'none' }}>
                            📲
                          </a>
                        )}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap sticky left-0 bg-white font-mono text-xs text-brand-500">{codigo}</td>
                      <td className="py-2 pr-4 whitespace-nowrap sticky left-0 bg-white">{nombre}</td>
                      {periodos.map((p) => {
                        const cell = rows.find((r) => r.cliente_id === cliente_id && r.periodo === p);
                        if (!cell) return <td key={p} />;
                        const style = STATUS_STYLE[cell.status];
                        const fechaPago = cell.status === 'pagado' ? pagosPorMes[`${cell.cliente_id}|${p.slice(0, 7)}`] : null;
                        return (
                          <td key={p} className="py-1 px-2 text-center">
                            <button
                              type="button"
                              title={`${formatPeriodoCorto(p)} · ${style.label}${
                                fechaPago ? ` · pagó el ${fechaPago.slice(8, 10)}/${fechaPago.slice(5, 7)}/${fechaPago.slice(0, 4)}` : ''
                              }`}
                              onClick={() => cell.status !== 'pagado' && irARegistrarPago(cell.cliente_id, cell.periodo)}
                              style={{
                                width: 38,
                                minHeight: 26,
                                padding: fechaPago ? '2px 0' : 0,
                                lineHeight: 1.1,
                                background: style.bg,
                                color: style.text,
                                border: 'none',
                                borderRadius: 6,
                                fontWeight: 600,
                                cursor: cell.status !== 'pagado' ? 'pointer' : 'default',
                              }}
                            >
                              {style.icon}
                              {fechaPago && (
                                <span style={{ display: 'block', fontSize: 10, fontWeight: 500 }}>
                                  {diaPagoCorto(fechaPago, p)}
                                </span>
                              )}
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