'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
import { formatBs, parsearFechaLocal, construirMensaje, linkWhatsApp } from '@/lib/utils';

function mesActualISO() {
  return new Date().toISOString().slice(0, 7); // yyyy-mm
}

function PagosPageInner() {
  const { isAdmin } = usePerfil();
  const { sucursalActiva } = useSucursalActiva();
  const searchParams = useSearchParams();
  const [pagos, setPagos] = useState([]);
  const [config, setConfig] = useState({});
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState('');
  const [tipoPago, setTipoPago] = useState('Mensual');
  const [mesesPersonalizado, setMesesPersonalizado] = useState(2);
  const [mesCorresponde, setMesCorresponde] = useState(mesActualISO());
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [edicion, setEdicion] = useState({ fecha_pago: '', monto: '', tipo_pago: 'Mensual', mes_corresponde: '', meses_cubiertos: 1 });

  async function cargarPagos() {
    let query = supabase
      .from('pagos')
      .select(
        'id, fecha_pago, monto, tipo_pago, mes_corresponde, meses_cubiertos, cliente_id, clientes!inner(codigo, nombre, telefono, activo, plan, precio, dia_pago, ciudad)'
      )
      .order('fecha_pago', { ascending: false })
      .limit(50);

    if (sucursalActiva && sucursalActiva !== 'Todas') {
      query = query.eq('clientes.ciudad', sucursalActiva);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al cargar pagos:', error);
      setPagos([]);
      return;
    }

    const idsClientes = [...new Set((data || []).map((p) => p.cliente_id))];
    const { data: estados } = await supabase
      .from('v_clientes_estado')
      .select('id, estado')
      .in('id', idsClientes.length > 0 ? idsClientes : ['00000000-0000-0000-0000-000000000000']);

    const estadoPorId = {};
    (estados || []).forEach((e) => (estadoPorId[e.id] = e.estado));

    const pagosConEstado = (data || []).map((p) => ({
      ...p,
      clientes: p.clientes ? { ...p.clientes, estado: estadoPorId[p.cliente_id] } : null,
    }));

    setPagos(pagosConEstado);
  }

  useEffect(() => {
    cargarPagos();
    supabase
      .from('config')
      .select('*')
      .then(({ data }) => {
        const cfg = {};
        (data || []).forEach((r) => (cfg[r.clave] = r.valor));
        setConfig(cfg);
      });
  }, [sucursalActiva]);

  // Si llegamos desde /pagos/mensual con ?cliente_id=...&mes=..., precargar el formulario
  useEffect(() => {
    const clienteId = searchParams.get('cliente_id');
    const mes = searchParams.get('mes');
    if (!clienteId) return;

    supabase
      .from('v_clientes_estado')
      .select('id, codigo, nombre, precio, telefono, activo, estado, plan, dia_pago')
      .eq('id', clienteId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setSeleccionado(data);
        setBusqueda(data.nombre);
        setMonto(data.precio || '');
        if (mes) setMesCorresponde(mes);
      });
  }, [searchParams]);

  function empezarEdicion(p) {
    setEditandoId(p.id);
    setEdicion({
      fecha_pago: p.fecha_pago.slice(0, 10),
      monto: p.monto,
      tipo_pago: p.tipo_pago || 'Mensual',
      mes_corresponde: (p.mes_corresponde || p.fecha_pago).slice(0, 7),
      meses_cubiertos: p.meses_cubiertos || 1,
    });
  }

  async function guardarEdicion(id) {
    const mesesCubiertos =
      edicion.tipo_pago === 'Semestral'
        ? 6
        : edicion.tipo_pago === 'Anual'
          ? 12
          : edicion.tipo_pago === 'Personalizado'
            ? Number(edicion.meses_cubiertos)
            : 1;
    const { error } = await supabase
      .from('pagos')
      .update({
        fecha_pago: edicion.fecha_pago,
        monto: Number(edicion.monto),
        tipo_pago: edicion.tipo_pago,
        mes_corresponde: `${edicion.mes_corresponde}-01`,
        meses_cubiertos: mesesCubiertos,
      })
      .eq('id', id);
    if (error) {
      setMsg('Error al modificar: ' + error.message);
      return;
    }
    setEditandoId(null);
    cargarPagos();
  }

  async function borrarPago(id, montoTexto) {
    if (!confirm(`¿Borrar el pago de ${montoTexto}? Esta acción no se puede deshacer.`)) return;
    if (!confirm('Confirma una vez más: ¿SEGURO que quieres borrar este pago definitivamente?')) return;
    const { error } = await supabase.from('pagos').delete().eq('id', id);
    if (error) {
      setMsg('Error al borrar: ' + error.message);
    } else {
      cargarPagos();
    }
  }

  async function buscarClientes(q) {
    setBusqueda(q);
    setSeleccionado(null);
    if (q.trim().length < 2) {
      setClientes([]);
      return;
    }
    let query = supabase
      .from('v_clientes_estado')
      .select('id, codigo, nombre, precio, telefono, activo, estado, plan, dia_pago')
      .ilike('nombre', `%${q}%`)
      .limit(8);

    if (sucursalActiva && sucursalActiva !== 'Todas') {
      query = query.eq('ciudad', sucursalActiva);
    }

    const { data } = await query;
    setClientes(data || []);
  }

  async function marcarMensajeEnviado(clienteId) {
    await supabase.from('clientes').update({ ultimo_mensaje_enviado: new Date().toISOString() }).eq('id', clienteId);
  }

  async function registrar(e) {
    e.preventDefault();
    if (!seleccionado || !monto) return;
    if (!confirm(`¿Confirmas registrar un pago de ${formatBs(monto)} para ${seleccionado.nombre}?`)) return;
    setGuardando(true);
    const mesesCubiertos =
      tipoPago === 'Semestral' ? 6 : tipoPago === 'Anual' ? 12 : tipoPago === 'Personalizado' ? Number(mesesPersonalizado) : 1;
    const { error } = await supabase.from('pagos').insert({
      cliente_id: seleccionado.id,
      fecha_pago: fecha,
      monto: Number(monto),
      tipo_pago: tipoPago,
      mes_corresponde: `${mesCorresponde}-01`,
      meses_cubiertos: mesesCubiertos,
    });
    setGuardando(false);
    if (error) {
      setMsg('Error: ' + error.message);
      return;
    }
    setMsg(`Pago de ${formatBs(monto)} registrado para ${seleccionado.nombre}.`);
    setSeleccionado(null);
    setBusqueda('');
    setClientes([]);
    setMonto('');
    setTipoPago('Mensual');
    setMesesPersonalizado(2);
    setMesCorresponde(mesActualISO());
    cargarPagos();
  }

  const mensajeWhatsApp = seleccionado ? construirMensaje(seleccionado, config, config.empresa_nombre) : '';
  const wa = seleccionado ? linkWhatsApp(seleccionado.telefono, mensajeWhatsApp) : null;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold text-brand-800 mb-6">Pagos</h1>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="card p-5 md:col-span-1 h-fit">
          <h2 className="font-semibold text-brand-700 mb-3">Registrar pago rápido</h2>
          <form onSubmit={registrar} className="space-y-3">
            <div>
              <label className="label">Buscar cliente</label>
              <input
                className="input"
                placeholder="Nombre del cliente…"
                value={busqueda}
                onChange={(e) => buscarClientes(e.target.value)}
              />
              {clientes.length > 0 && !seleccionado && (
                <div className="border border-brand-100 rounded-lg mt-1 max-h-48 overflow-y-auto">
                  {clientes.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setSeleccionado(c);
                        setMonto(c.precio || '');
                        setBusqueda(c.nombre);
                        setClientes([]);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-brand-50"
                    >
                      {c.nombre} <span className="text-brand-400 font-mono text-xs">({c.codigo})</span>
                    </button>
                  ))}
                </div>
              )}
              {seleccionado && (
                <div className="text-xs text-brand-500 mt-1">Cliente: {seleccionado.codigo}</div>
              )}
            </div>

            {seleccionado && seleccionado.activo && wa && (
              <a href={wa} target="_blank" rel="noreferrer" onClick={() => marcarMensajeEnviado(seleccionado.id)} className="btn-whatsapp w-full justify-center">
                📲 Enviar WhatsApp a {seleccionado.nombre.split(' ')[0]}
              </a>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <label className="label">Monto (Bs)</label>
                <input type="number" step="0.01" className="input" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo de pago</label>
                <select className="input" value={tipoPago} onChange={(e) => setTipoPago(e.target.value)}>
                  <option value="Mensual">Mensual</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                  <option value="Personalizado">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="label">¿Mes corresponde?</label>
                <input
                  type="month"
                  className="input"
                  value={mesCorresponde}
                  onChange={(e) => setMesCorresponde(e.target.value)}
                />
              </div>
            </div>
            {tipoPago === 'Personalizado' && (
              <div>
                <label className="label">¿Cuántos meses cubre este pago?</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={mesesPersonalizado}
                  onChange={(e) => setMesesPersonalizado(e.target.value)}
                />
              </div>
            )}
            <p className="text-xs text-brand-400 -mt-1">
              El mes es el primero que cubre el pago — Semestral/Anual calculan solos los siguientes.
            </p>
            <button disabled={!seleccionado || guardando} type="submit" className="btn-primary w-full">
              {guardando ? 'Registrando…' : 'Registrar pago'}
            </button>
            {msg && <p className="text-sm text-brand-600">{msg}</p>}
          </form>
        </div>

        <div className="card p-5 md:col-span-2">
          <h2 className="font-semibold text-brand-700 mb-3">Últimos pagos</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 border-b border-brand-100">
                <th className="py-2">Fecha</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">Monto</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Mes</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => {
                const mensajeCliente = p.clientes ? construirMensaje(p.clientes, config, config.empresa_nombre) : '';
                const waPago = p.clientes ? linkWhatsApp(p.clientes.telefono, mensajeCliente) : null;

                return (
                  <tr key={p.id} className="border-b border-brand-50">
                    {editandoId === p.id ? (
                      <>
                        <td className="py-2">
                          <input
                            type="date"
                            className="input"
                            value={edicion.fecha_pago}
                            onChange={(e) => setEdicion({ ...edicion, fecha_pago: e.target.value })}
                          />
                        </td>
                        <td className="py-2">
                          {p.clientes?.nombre}{' '}
                          <span className="text-brand-400 font-mono text-xs">({p.clientes?.codigo})</span>
                        </td>
                        <td className="py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={edicion.monto}
                            onChange={(e) => setEdicion({ ...edicion, monto: e.target.value })}
                          />
                        </td>
                        <td className="py-2">
                          <select
                            className="input"
                            value={edicion.tipo_pago}
                            onChange={(e) => setEdicion({ ...edicion, tipo_pago: e.target.value })}
                          >
                            <option value="Mensual">Mensual</option>
                            <option value="Semestral">Semestral</option>
                            <option value="Anual">Anual</option>
                            <option value="Personalizado">Personalizado</option>
                          </select>
                        </td>
                        <td className="py-2">
                          <input
                            type="month"
                            className="input mb-1"
                            value={edicion.mes_corresponde}
                            onChange={(e) => setEdicion({ ...edicion, mes_corresponde: e.target.value })}
                          />
                          {edicion.tipo_pago === 'Personalizado' && (
                            <input
                              type="number"
                              min="1"
                              className="input"
                              placeholder="N° meses"
                              value={edicion.meses_cubiertos}
                              onChange={(e) => setEdicion({ ...edicion, meses_cubiertos: e.target.value })}
                            />
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-2 text-right whitespace-nowrap align-top">
                            <button onClick={() => guardarEdicion(p.id)} className="text-brand-600 hover:underline text-xs mr-2">
                              Guardar
                            </button>
                            <button onClick={() => setEditandoId(null)} className="text-brand-400 hover:underline text-xs">
                              Cancelar
                            </button>
                          </td>
                        )}
                      </>
                    ) : (
                      <>
                        <td className="py-2">{parsearFechaLocal(p.fecha_pago).toLocaleDateString('es-BO')}</td>
                        <td className="py-2">
                          {p.clientes?.nombre}{' '}
                          <span className="text-brand-400 font-mono text-xs">({p.clientes?.codigo})</span>
                        </td>
                        <td className="py-2">{formatBs(p.monto)}</td>
                        <td className="py-2 text-brand-400 text-xs">
                          {p.tipo_pago || 'Mensual'}
                          {p.tipo_pago === 'Personalizado' ? ` (${p.meses_cubiertos} m.)` : ''}
                        </td>
                        <td className="py-2 text-brand-400 text-xs capitalize">
                          {p.mes_corresponde
                            ? parsearFechaLocal(p.mes_corresponde).toLocaleDateString('es-BO', { month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          {waPago && (
                            <a href={waPago} target="_blank" rel="noreferrer" onClick={() => marcarMensajeEnviado(p.cliente_id)} title={`Enviar WhatsApp a ${p.clientes?.nombre}`} style={{ marginRight: 10, textDecoration: 'none' }}>
                              📲
                            </a>
                          )}
                          {isAdmin && (
                            <>
                              <button onClick={() => empezarEdicion(p)} className="text-brand-600 hover:underline text-xs mr-3">
                                Editar
                              </button>
                              <button onClick={() => borrarPago(p.id, formatBs(p.monto))} className="text-red-500 hover:underline text-xs">
                                Borrar
                              </button>
                            </>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

export default function PagosPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando...</div>}>
      <PagosPageInner />
    </Suspense>
  );
}