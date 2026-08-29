'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
import { formatBs, parsearFechaLocal, construirMensaje, linkWhatsApp } from '@/lib/utils';

const PAGE_SIZE = 50;

function mesActualISO() {
  return new Date().toISOString().slice(0, 7); // yyyy-mm
}

function mesesCubiertosPorTipo(tipo, mesesPersonalizado) {
  if (tipo === 'Semestral') return 6;
  if (tipo === 'Anual') return 12;
  if (tipo === 'Personalizado') return Number(mesesPersonalizado);
  if (tipo === 'Costo de instalación') return 0;
  return 1; // Mensual
}

function PagosPageInner() {
  const { isAdmin } = usePerfil();
  const { sucursalActiva } = useSucursalActiva();
  const searchParams = useSearchParams();
  const [pagos, setPagos] = useState([]);
  const [totalPagos, setTotalPagos] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [config, setConfig] = useState({});
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaPagos, setBusquedaPagos] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState('');
  const [tipoPago, setTipoPago] = useState('Mensual');
  const [mesesPersonalizado, setMesesPersonalizado] = useState(2);
  const [mesCorresponde, setMesCorresponde] = useState(mesActualISO());
  const [facturado, setFacturado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [edicion, setEdicion] = useState({ fecha_pago: '', monto: '', tipo_pago: 'Mensual', mes_corresponde: '', meses_cubiertos: 1, con_factura: false });

  async function cargarPagos() {
    let query = supabase
      .from('pagos')
      .select(
        'id, fecha_pago, monto, tipo_pago, mes_corresponde, meses_cubiertos, cliente_id, con_factura, clientes!inner(codigo, nombre, telefono, activo, plan, precio, dia_pago, ciudad)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE - 1);

    if (sucursalActiva && sucursalActiva !== 'Todas') {
      query = query.eq('clientes.ciudad', sucursalActiva);
    }

    const q = busquedaPagos.trim();
    if (q) {
      query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`, { foreignTable: 'clientes' });
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al cargar pagos:', error);
      setPagos([]);
      return;
    }

    setPagos(data || []);
    setTotalPagos(count || 0);
  }

  useEffect(() => {
    setPagina(1);
  }, [busquedaPagos]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarPagos();
    }, 300);
    return () => clearTimeout(timer);
  }, [sucursalActiva, pagina, busquedaPagos]);

  useEffect(() => {
    supabase
      .from('config')
      .select('*')
      .then(({ data }) => {
        const cfg = {};
        (data || []).forEach((r) => (cfg[r.clave] = r.valor));
        setConfig(cfg);
      });
  }, []);

  useEffect(() => {
    const clienteId = searchParams.get('cliente_id');
    const mes = searchParams.get('mes');
    if (!clienteId) return;

    supabase
      .from('v_clientes_estado')
      .select('id, codigo, nombre, precio, telefono, activo, estado, plan, dia_pago, factura')
      .eq('id', clienteId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setSeleccionado(data);
        setBusqueda(data.nombre);
        setMonto(data.precio || '');
        setFacturado(!!data.factura);
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
      con_factura: !!p.con_factura,
    });
  }

  async function guardarEdicion(id) {
    const mesesCubiertos = mesesCubiertosPorTipo(edicion.tipo_pago, edicion.meses_cubiertos);
    const { error } = await supabase
      .from('pagos')
      .update({
        fecha_pago: edicion.fecha_pago,
        monto: Number(edicion.monto),
        tipo_pago: edicion.tipo_pago,
        mes_corresponde: `${edicion.mes_corresponde}-01`,
        meses_cubiertos: mesesCubiertos,
        con_factura: edicion.con_factura,
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
      .select('id, codigo, nombre, precio, telefono, activo, estado, plan, dia_pago, factura')
      .ilike('nombre', `%${q}%`)
      .limit(8);

    if (sucursalActiva && sucursalActiva !== 'Todas') {
      query = query.eq('ciudad', sucursalActiva);
    }

    const { data } = await query;
    setClientes(data || []);
  }

  async function registrar(e) {
    e.preventDefault();
    if (!seleccionado || !monto) return;

    const mesesCubiertos = mesesCubiertosPorTipo(tipoPago, mesesPersonalizado);

    if (mesesCubiertos > 0) {
      const [anio, mes] = mesCorresponde.split('-').map(Number);
      const fechaCobertura = new Date(anio, mes - 1 + mesesCubiertos, 0);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (fechaCobertura < hoy) {
        const seguro = confirm(
          `⚠️ Atención: con "${mesCorresponde}" como mes correspondiente, este pago cubre hasta el ${fechaCobertura.toLocaleDateString('es-BO')}, que ya pasó — el cliente va a aparecer como VENCIDO apenas guardes.\n\n¿Es correcto igual, o preferís cancelar y cambiar el mes?\n\nAceptar = guardar igual. Cancelar = no guardar.`
        );
        if (!seguro) return;
      }
    }

    if (!confirm(`¿Confirmas registrar un pago de ${formatBs(monto)} para ${seleccionado.nombre}?`)) return;
    setGuardando(true);
    const { error } = await supabase.from('pagos').insert({
      cliente_id: seleccionado.id,
      fecha_pago: fecha,
      monto: Number(monto),
      tipo_pago: tipoPago,
      mes_corresponde: `${mesCorresponde}-01`,
      meses_cubiertos: mesesCubiertos,
      con_factura: facturado,
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
    setFacturado(false);
    if (pagina !== 1) {
      setPagina(1);
    } else {
      cargarPagos();
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(totalPagos / PAGE_SIZE));

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
                        setFacturado(!!c.factura);
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
                  <option value="Costo de instalación">Costo de instalación</option>
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

            <button
              type="button"
              onClick={() => setFacturado(!facturado)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 8,
                border: facturado ? '2px solid #085041' : '2px solid #ddd',
                background: facturado ? '#E1F5EE' : '#fafafa',
                color: facturado ? '#085041' : '#666',
                fontWeight: 600,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              {facturado ? '🧾 ✅ Requiere factura' : '🧾 Requiere factura'}
            </button>

            <button disabled={!seleccionado || guardando} type="submit" className="btn-primary w-full">
              {guardando ? 'Registrando…' : 'Registrar pago'}
            </button>
            {msg && <p className="text-sm text-brand-600">{msg}</p>}
          </form>
        </div>

        <div className="card p-5 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-brand-700">Últimos pagos</h2>
            <input
              className="input md:max-w-xs"
              placeholder="Buscar por nombre o ID…"
              value={busquedaPagos}
              onChange={(e) => setBusquedaPagos(e.target.value)}
            />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 border-b border-brand-100">
                <th className="py-2">Fecha</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">Monto</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Mes</th>
                <th className="py-2 text-center" title="¿Se emitió factura por este pago?">Factura</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => {
                const mensajeCliente = p.clientes
                  ? construirMensaje({ ...p.clientes, activo: true, estado: 'Al día' }, config, config.empresa_nombre)
                  : '';
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
                            <option value="Costo de instalación">Costo de instalación</option>
                          </select>
                        </td>
                        <td className="py-2">
                          <input
                            type="month"
                            className="input"
                            value={edicion.mes_corresponde}
                            onChange={(e) => setEdicion({ ...edicion, mes_corresponde: e.target.value })}
                          />
                          {edicion.tipo_pago === 'Personalizado' && (
                            <input
                              type="number"
                              min="1"
                              className="input mt-1"
                              placeholder="N° meses"
                              value={edicion.meses_cubiertos}
                              onChange={(e) => setEdicion({ ...edicion, meses_cubiertos: e.target.value })}
                            />
                          )}
                        </td>
                        <td className="py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!edicion.con_factura}
                            onChange={(e) => setEdicion({ ...edicion, con_factura: e.target.checked })}
                          />
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
                        <td className="py-2 text-center" title={p.con_factura ? 'Facturado' : 'Sin facturar'}>
                          {p.con_factura ? '🧾' : '—'}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          {waPago && (
                            <a href={waPago} target="_blank" rel="noreferrer" title={`Enviar WhatsApp a ${p.clientes?.nombre}`} style={{ marginRight: 10, textDecoration: 'none' }}>
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

          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-brand-400">
              Página {pagina} de {totalPaginas} · {totalPagos} pagos en total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                className="btn-secondary"
                style={{ opacity: pagina <= 1 ? 0.5 : 1 }}
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                className="btn-secondary"
                style={{ opacity: pagina >= totalPaginas ? 0.5 : 1 }}
              >
                Siguiente →
              </button>
            </div>
          </div>
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