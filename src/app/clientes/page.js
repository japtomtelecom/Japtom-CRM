'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
import { formatBs, linkWhatsApp, construirMensaje } from '@/lib/utils';
import { exportarExcel } from '@/lib/exportExcel';

function Badge({ cliente }) {
  if (!cliente.activo) return <span className="badge-inactivo">Inactivo</span>;
  return cliente.estado === 'Al día' ? (
    <span className="badge-al-dia">Al día</span>
  ) : (
    <span className="badge-vencido">Vencido</span>
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

  useEffect(() => {
    if (sucursalActiva) setCiudadFiltro(sucursalActiva === 'Todas' ? 'todas' : sucursalActiva);
  }, [sucursalActiva]);

  useEffect(() => {
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
      </div>

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
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => marcarMensajeEnviado(c.id)}
                        title="Enviar WhatsApp"
                        className="mr-3"
                      >
                        📲
                      </a>
                    )}
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
    </AppShell>
  );
}