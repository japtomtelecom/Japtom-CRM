'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
import { formatBs, linkWhatsApp, construirMensaje, construirMensajeCorte, construirMensajeRecordatorio } from '@/lib/utils';
import { exportarExcel } from '@/lib/exportExcel';

const STATUS_STYLE = {
  pagado: { bg: '#E1F5EE', text: '#085041', label: 'Pagado' },
  no_vencido: { bg: '#F1EFE8', text: '#5F5E5A', label: 'Aún no vence' },
  por_vencer: { bg: '#FAEEDA', text: '#854F0B', label: 'Vencido (1-5 días)' },
  vencido: { bg: '#FCEBEB', text: '#791F1F', label: 'Vencido (+5 días)' },
};

function formatPeriodoCorto(periodo) {
  const d = new Date(periodo.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' });
}

function Badge({ cliente }) {
  if (!cliente.activo) return <span className="badge-inactivo">Inactivo</span>;
  return cliente.estado === 'Al día' ? (
    <span className="badge-al-dia">Al día</span>
  ) : (
    <span className="badge-vencido">Vencido</span>
  );
}

function ModalMeses({ cliente, onClose }) {
  const [meses, setMeses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      const { data } = await supabase
        .from('v_registro_pagos_mensual')
        .select('periodo, status')
        .eq('cliente_id', cliente.id)
        .order('periodo');
      setMeses(data || []);
      setLoading(false);
    }
    cargar();
  }, [cliente.id]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 360, maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{cliente.nombre}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: -8 }}>{cliente.codigo} · Registro mensual</p>

        {loading ? (
          <p className="text-sm text-brand-400">Cargando…</p>
        ) : (
          <ul style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {meses.map((m) => {
              const style = STATUS_STYLE[m.status];
              return (
                <li
                  key={m.periodo}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: style?.bg,
                    color: style?.text,
                    fontSize: 13,
                  }}
                >
                  <span>{formatPeriodoCorto(m.periodo)}</span>
                  <span style={{ fontWeight: 600 }}>{style?.label}</span>
                </li>
              );
            })}
          </ul>
        )}

        <button onClick={onClose} className="btn-secondary w-full mt-4">
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const { sucursalActiva, esFija } = useSucursalActiva();
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [ciudadFiltro, setCiudadFiltro] = useState('todas');
  const [diaPagoFiltro, setDiaPagoFiltro] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({});
  const [clienteMeses, setClienteMeses] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (sucursalActiva) setCiudadFiltro(sucursalActiva === 'Todas' ? 'todas' : sucursalActiva);
  }, [sucursalActiva]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('v_clientes_estado')
      .select('*')
      .order('codigo', { ascending: true });
    setClientes(data || []);
    const { data: cfgRows } = await supabase.from('config').select('*');
    const cfg = {};
    (cfgRows || []).forEach((r) => (cfg[r.clave] = r.valor));
    setConfig(cfg);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function marcarMensajeEnviado(clienteId) {
    await supabase
      .from('clientes')
      .update({ ultimo_mensaje_enviado: new Date().toISOString() })
      .eq('id', clienteId);
    setClientes((prev) =>
      prev.map((c) => (c.id === clienteId ? { ...c, ultimo_mensaje_enviado: new Date().toISOString() } : c))
    );
  }

  // Clientes activos, vencidos, con ese día de pago exacto — son a los que
  // apunta el botón de envío masivo cuando hay un día de pago seleccionado
  // en el filtro de arriba.
  const vencidosDelDiaFiltro = useMemo(() => {
    if (diaPagoFiltro === 'todos') return [];
    return clientes.filter(
      (c) => c.activo && c.estado === 'Vencido' && Number(c.dia_pago) === Number(diaPagoFiltro)
    );
  }, [clientes, diaPagoFiltro]);

  async function enviarMasivoDia() {
    const dia = diaPagoFiltro;
    const candidatos = vencidosDelDiaFiltro
      .map((c) => ({
        cliente: c,
        wa: linkWhatsApp(c.telefono, construirMensaje(c, config, config.empresa_nombre)),
      }))
      .filter((x) => x.wa);

    if (candidatos.length === 0) {
      setMsg(`No hay clientes vencidos con día de pago ${dia} y teléfono válido.`);
      return;
    }

    const nombres = candidatos.map((x) => x.cliente.nombre).join(', ');
    const confirmado = confirm(
      `¿Confirmas enviar el recordatorio de pago a ${candidatos.length} cliente(s) vencido(s) del día ${dia}?\n\n` +
        `${nombres}\n\n` +
        `Se abrirá una pestaña de WhatsApp por cada uno con el mensaje ya escrito (tienes que darle Enviar en ` +
        `cada una). Si el navegador bloquea las pestañas, permite los pop-ups para este sitio y vuelve a intentar.`
    );
    if (!confirmado) return;

    candidatos.forEach(({ wa }) => window.open(wa, '_blank'));
    await Promise.all(candidatos.map(({ cliente }) => marcarMensajeEnviado(cliente.id)));
    setMsg(`Se abrieron ${candidatos.length} pestaña(s) de WhatsApp para el día ${dia}.`);
  }

  const diasDisponibles = useMemo(() => {
    const set = new Set();
    clientes.forEach((c) => {
      if (c.dia_pago !== null && c.dia_pago !== undefined) set.add(Number(c.dia_pago));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [clientes]);

  const filtrados = useMemo(() => {
    let lista = clientes;
    if (ciudadFiltro !== 'todas') lista = lista.filter((c) => c.ciudad === ciudadFiltro);
    if (filtro === 'activos') lista = lista.filter((c) => c.activo);
    if (filtro === 'inactivos') lista = lista.filter((c) => !c.activo);
    if (filtro === 'vencidos') lista = lista.filter((c) => c.activo && c.estado === 'Vencido');
    if (filtro === 'al_dia') lista = lista.filter((c) => c.activo && c.estado === 'Al día');
    if (diaPagoFiltro !== 'todos') {
      lista = lista.filter((c) => Number(c.dia_pago) === Number(diaPagoFiltro));
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(
        (c) => c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [clientes, busqueda, filtro, ciudadFiltro, diaPagoFiltro]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-800">Clientes</h1>
          <p className="text-brand-500 text-sm">{clientes.length} clientes registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportarExcel()} className="btn-secondary">
            ⬇️ Excel
          </button>
          <Link href="/clientes/nuevo" className="btn-primary">
            + Agregar cliente
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input md:max-w-xs"
          placeholder="Buscar por nombre o ID…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {esFija ? (
          <span className="input md:max-w-[180px] flex items-center bg-brand-50 text-brand-600">
            📍 {ciudadFiltro}
          </span>
        ) : (
          <select className="input md:max-w-[180px]" value={ciudadFiltro} onChange={(e) => setCiudadFiltro(e.target.value)}>
            <option value="todas">Todas las ciudades</option>
            <option value="El Alto">El Alto</option>
            <option value="Tarija">Tarija</option>
          </select>
        )}
        <select className="input md:max-w-[180px]" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="al_dia">Al día</option>
          <option value="vencidos">Vencidos</option>
        </select>
        <select
          className="input md:max-w-[180px]"
          value={diaPagoFiltro}
          onChange={(e) => setDiaPagoFiltro(e.target.value)}
        >
          <option value="todos">Día de pago: todos</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
            <option key={dia} value={dia} disabled={!diasDisponibles.includes(dia)}>
              Día {dia}
            </option>
          ))}
        </select>
        {diaPagoFiltro !== 'todos' && vencidosDelDiaFiltro.length > 0 && (
          <button onClick={enviarMasivoDia} className="btn-primary">
            📤 Enviar recordatorio masivo (día {diaPagoFiltro}) · {vencidosDelDiaFiltro.length}
          </button>
        )}
      </div>

      {msg && <p className="text-sm text-brand-600 mb-3">{msg}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brand-500 border-b border-brand-100">
              <th className="p-3">ID</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Ciudad</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Precio</th>
              <th className="p-3">Día de pago</th>
              <th className="p-3">Estado</th>
              <th className="p-3" title="¿Ya se le envió mensaje de WhatsApp?">Mensaje</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="p-4 text-brand-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-brand-400">
                  No se encontraron clientes.
                </td>
              </tr>
            )}
            {filtrados.map((c) => {
              const mensaje = construirMensaje(c, config, config.empresa_nombre);
              const wa = linkWhatsApp(c.telefono, mensaje);
              const mensajeCorte = construirMensajeCorte(c, config, config.empresa_nombre);
              const waCorte = linkWhatsApp(c.telefono, mensajeCorte);
              const mensajeRecordatorio = construirMensajeRecordatorio(c, config, config.empresa_nombre);
              const waRecordatorio = linkWhatsApp(c.telefono, mensajeRecordatorio);
              return (
                <tr key={c.id} className="border-b border-brand-50 hover:bg-brand-50/60">
                  <td className="p-3 font-mono text-xs">{c.codigo}</td>
                  <td className="p-3 font-medium">{c.nombre}</td>
                  <td className="p-3">{c.ciudad || 'El Alto'}</td>
                  <td className="p-3">{c.plan || '—'}</td>
                  <td className="p-3">{formatBs(c.precio)}</td>
                  <td className="p-3">{c.dia_pago ?? '—'}</td>
                  <td className="p-3">
                    <Badge cliente={c} />
                  </td>
                  <td className="p-3 text-center" title={c.ultimo_mensaje_enviado ? new Date(c.ultimo_mensaje_enviado).toLocaleString('es-BO') : 'Aún no se le envió mensaje'}>
                    {c.ultimo_mensaje_enviado ? <span className="text-brand-500">✅</span> : <span className="text-brand-200">—</span>}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setClienteMeses(c)}
                      title="Ver registro mensual"
                      className="mr-3"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      📅
                    </button>
                    {wa && (
                      
                       <a href={wa}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => marcarMensajeEnviado(c.id)}
                        title="Enviar WhatsApp"
                        className="mr-3"
                      >
                        📲
                      </a>
                    )}
                    {waRecordatorio && (
                      <a
                        href={waRecordatorio}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => marcarMensajeEnviado(c.id)}
                        title="Enviar recordatorio de pago (mensaje fijo, sin importar el estado)"
                        className="mr-3"
                      >
                        🔔
                      </a>
                    )}
                    {waCorte && (
                      <a
                        href={waCorte}
                        target="_blank"
                        rel="noreferrer"
                        title="Enviar aviso de corte por falta de pago"
                        className="mr-3"
                      >
                        ✂️
                      </a>
                    )}
                    <Link
                      href={`/pagos?cliente_id=${c.id}`}
                      title="Registrar pago para este cliente"
                      className="text-brand-600 hover:underline mr-3"
                    >
                      💵 Registrar pago
                    </Link>
                    <Link href={`/clientes/${c.codigo}`} className="text-brand-600 hover:underline">
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {clienteMeses && <ModalMeses cliente={clienteMeses} onClose={() => setClienteMeses(null)} />}
    </AppShell>
  );
}