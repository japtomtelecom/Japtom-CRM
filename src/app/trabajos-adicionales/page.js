'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
import { formatBs } from '@/lib/utils';

const TIPOS = [
  'Instalación de cámaras',
  'Cableado estructurado',
  'Configuración de red',
  'Venta de equipo',
  'Otro',
];

export default function TrabajosAdicionalesPage() {
  const { isAdmin } = usePerfil();
  const { sucursalActiva, esFija } = useSucursalActiva();

  const [trabajos, setTrabajos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ciudadFiltro, setCiudadFiltro] = useState('todas');
  const [msg, setMsg] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [edicion, setEdicion] = useState(null);

  const [clientes, setClientes] = useState([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [nombreExterno, setNombreExterno] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [costoMateriales, setCostoMateriales] = useState('');
  const [ciudad, setCiudad] = useState('El Alto');
  const [conFactura, setConFactura] = useState(false);
  const [nit, setNit] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (sucursalActiva) {
      setCiudadFiltro(sucursalActiva === 'Todas' ? 'todas' : sucursalActiva);
      if (sucursalActiva !== 'Todas') setCiudad(sucursalActiva);
    }
  }, [sucursalActiva]);

  async function cargar() {
    setLoading(true);
    let query = supabase
      .from('trabajos_adicionales')
      .select('*, clientes(nombre, codigo)')
      .order('fecha', { ascending: false });

    if (ciudadFiltro !== 'todas') query = query.eq('ciudad', ciudadFiltro);

    const { data, error } = await query;
    if (error) {
      console.error('Error al cargar trabajos adicionales:', error);
      setTrabajos([]);
    } else {
      setTrabajos(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciudadFiltro]);

  async function buscarClientes(q) {
    setBusquedaCliente(q);
    setClienteSeleccionado(null);
    if (q.trim().length < 2) {
      setClientes([]);
      return;
    }
    let query = supabase
      .from('clientes')
      .select('id, codigo, nombre, ciudad')
      .ilike('nombre', `%${q}%`)
      .limit(8);
    if (sucursalActiva && sucursalActiva !== 'Todas') query = query.eq('ciudad', sucursalActiva);
    const { data } = await query;
    setClientes(data || []);
  }

  function limpiarFormulario() {
    setBusquedaCliente('');
    setClienteSeleccionado(null);
    setNombreExterno('');
    setFecha(new Date().toISOString().slice(0, 10));
    setTipo(TIPOS[0]);
    setDescripcion('');
    setMonto('');
    setCostoMateriales('');
    setConFactura(false);
    setNit('');
  }

  async function registrar(e) {
    e.preventDefault();
    if (!monto) {
      setMsg('Ingresá un monto.');
      return;
    }
    if (!clienteSeleccionado && !nombreExterno.trim()) {
      setMsg('Elegí un cliente existente, o escribí el nombre de la persona/empresa.');
      return;
    }

    setGuardando(true);
    setMsg('');

    const { error } = await supabase.from('trabajos_adicionales').insert({
      fecha,
      cliente_id: clienteSeleccionado ? clienteSeleccionado.id : null,
      nombre_cliente_externo: clienteSeleccionado ? null : nombreExterno.trim(),
      tipo,
      descripcion: descripcion.trim() || null,
      monto: Number(monto),
      costo_materiales: costoMateriales ? Number(costoMateriales) : 0,
      ciudad,
      con_factura: conFactura,
      nit: conFactura ? nit.trim() || null : null,
    });

    setGuardando(false);

    if (error) {
      setMsg('Error al guardar: ' + error.message);
      return;
    }

    setMsg('Trabajo adicional registrado correctamente.');
    limpiarFormulario();
    cargar();
  }

  function empezarEdicion(t) {
    setEditandoId(t.id);
    setEdicion({
      fecha: t.fecha,
      tipo: t.tipo,
      descripcion: t.descripcion || '',
      monto: t.monto,
      costo_materiales: t.costo_materiales || 0,
      con_factura: !!t.con_factura,
      nit: t.nit || '',
    });
  }

  async function guardarEdicion(id) {
    const { error } = await supabase
      .from('trabajos_adicionales')
      .update({
        fecha: edicion.fecha,
        tipo: edicion.tipo,
        descripcion: edicion.descripcion || null,
        monto: Number(edicion.monto),
        costo_materiales: Number(edicion.costo_materiales) || 0,
        con_factura: edicion.con_factura,
        nit: edicion.con_factura ? edicion.nit || null : null,
      })
      .eq('id', id);
    if (error) {
      setMsg('Error al modificar: ' + error.message);
      return;
    }
    setEditandoId(null);
    cargar();
  }

  async function borrar(id, montoTexto) {
    if (!confirm(`¿Borrar este trabajo adicional de ${montoTexto}? No se puede deshacer.`)) return;
    const { error } = await supabase.from('trabajos_adicionales').delete().eq('id', id);
    if (error) {
      setMsg('Error al borrar: ' + error.message);
    } else {
      cargar();
    }
  }

  const totalIngresos = trabajos.reduce((a, t) => a + Number(t.monto || 0), 0);
  const totalCostos = trabajos.reduce((a, t) => a + Number(t.costo_materiales || 0), 0);
  const gananciaNeta = totalIngresos - totalCostos;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-800">Trabajos adicionales</h1>
        {esFija ? (
          <span className="text-sm text-brand-500">📍 Sucursal: {ciudadFiltro}</span>
        ) : (
          <select className="input md:max-w-[200px]" value={ciudadFiltro} onChange={(e) => setCiudadFiltro(e.target.value)}>
            <option value="todas">Todas las ciudades</option>
            <option value="El Alto">El Alto</option>
            <option value="Tarija">Tarija</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-brand-500 text-sm">Ingresos totales</div>
          <div className="text-2xl font-bold mt-1 text-brand-800">{formatBs(totalIngresos)}</div>
        </div>
        <div className="card p-5">
          <div className="text-brand-500 text-sm">Costo de materiales</div>
          <div className="text-2xl font-bold mt-1 text-brand-800">{formatBs(totalCostos)}</div>
        </div>
        <div className="card p-5">
          <div className="text-brand-500 text-sm">Ganancia neta</div>
          <div className="text-2xl font-bold mt-1 text-accent">{formatBs(gananciaNeta)}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="card p-5 md:col-span-1 h-fit">
          <h2 className="font-semibold text-brand-700 mb-3">Registrar trabajo adicional</h2>
          <form onSubmit={registrar} className="space-y-3">
            <div>
              <label className="label">Cliente (opcional, si ya está en el CRM)</label>
              <input
                className="input"
                placeholder="Buscar por nombre…"
                value={busquedaCliente}
                onChange={(e) => buscarClientes(e.target.value)}
              />
              {clientes.length > 0 && !clienteSeleccionado && (
                <div className="border border-brand-100 rounded-lg mt-1 max-h-40 overflow-y-auto">
                  {clientes.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setClienteSeleccionado(c);
                        setBusquedaCliente(c.nombre);
                        setClientes([]);
                        setCiudad(c.ciudad || 'El Alto');
                      }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-brand-50"
                    >
                      {c.nombre} <span className="text-brand-400 font-mono text-xs">({c.codigo})</span>
                    </button>
                  ))}
                </div>
              )}
              {clienteSeleccionado && (
                <div className="text-xs text-brand-500 mt-1">Cliente: {clienteSeleccionado.codigo}</div>
              )}
            </div>

            {!clienteSeleccionado && (
              <div>
                <label className="label">O nombre de quien no es cliente</label>
                <input
                  className="input"
                  placeholder="Ej: Vecino, empresa externa…"
                  value={nombreExterno}
                  onChange={(e) => setNombreExterno(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <label className="label">Ciudad</label>
                <select className="input" value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
                  <option value="El Alto">El Alto</option>
                  <option value="Tarija">Tarija</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Tipo de trabajo</label>
              <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Descripción (detalle del trabajo)</label>
              <textarea
                className="input"
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Cableado de 4 puntos de red en oficina, instalación de router..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Monto cobrado (Bs)</label>
                <input type="number" step="0.01" className="input" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </div>
              <div>
                <label className="label">Costo de materiales (Bs)</label>
                <input type="number" step="0.01" className="input" value={costoMateriales} onChange={(e) => setCostoMateriales(e.target.value)} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConFactura(!conFactura)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 8,
                border: conFactura ? '2px solid #085041' : '2px solid #ddd',
                background: conFactura ? '#E1F5EE' : '#fafafa',
                color: conFactura ? '#085041' : '#666',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {conFactura ? '🧾 ✅ Requiere factura' : '🧾 Requiere factura'}
            </button>

            {conFactura && (
              <div>
                <label className="label">NIT</label>
                <input className="input" value={nit} onChange={(e) => setNit(e.target.value)} />
              </div>
            )}

            <button disabled={guardando} type="submit" className="btn-primary w-full">
              {guardando ? 'Guardando…' : 'Registrar trabajo'}
            </button>
            {msg && <p className="text-sm text-brand-600">{msg}</p>}
          </form>
        </div>

        <div className="card p-5 md:col-span-2 overflow-x-auto">
          <h2 className="font-semibold text-brand-700 mb-3">Historial de trabajos adicionales</h2>
          {loading ? (
            <p className="text-brand-400 text-sm">Cargando…</p>
          ) : trabajos.length === 0 ? (
            <p className="text-brand-400 text-sm">Aún no hay trabajos adicionales registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 border-b border-brand-100">
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Cliente / Nombre</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Monto</th>
                  <th className="py-2">Costo</th>
                  <th className="py-2">Ganancia</th>
                  <th className="py-2 text-center">Factura</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {trabajos.map((t) => {
                  const nombreMostrar = t.clientes?.nombre || t.nombre_cliente_externo || '—';
                  const ganancia = Number(t.monto || 0) - Number(t.costo_materiales || 0);

                  return (
                    <tr key={t.id} className="border-b border-brand-50">
                      {editandoId === t.id ? (
                        <>
                          <td className="py-2">
                            <input
                              type="date"
                              className="input"
                              value={edicion.fecha}
                              onChange={(e) => setEdicion({ ...edicion, fecha: e.target.value })}
                            />
                          </td>
                          <td className="py-2">{nombreMostrar}</td>
                          <td className="py-2">
                            <select
                              className="input"
                              value={edicion.tipo}
                              onChange={(e) => setEdicion({ ...edicion, tipo: e.target.value })}
                            >
                              {TIPOS.map((tp) => (
                                <option key={tp} value={tp}>{tp}</option>
                              ))}
                            </select>
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
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={edicion.costo_materiales}
                              onChange={(e) => setEdicion({ ...edicion, costo_materiales: e.target.value })}
                            />
                          </td>
                          <td className="py-2 text-brand-400 text-xs">
                            {formatBs(Number(edicion.monto || 0) - Number(edicion.costo_materiales || 0))}
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={edicion.con_factura}
                              onChange={(e) => setEdicion({ ...edicion, con_factura: e.target.checked })}
                            />
                          </td>
                          {isAdmin && (
                            <td className="py-2 text-right whitespace-nowrap">
                              <button onClick={() => guardarEdicion(t.id)} className="text-brand-600 hover:underline text-xs mr-2">
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
                          <td className="py-2">{new Date(t.fecha + 'T00:00:00').toLocaleDateString('es-BO')}</td>
                          <td className="py-2">{nombreMostrar}</td>
                          <td className="py-2 text-brand-400 text-xs">{t.tipo}</td>
                          <td className="py-2">{formatBs(t.monto)}</td>
                          <td className="py-2 text-brand-400">{formatBs(t.costo_materiales || 0)}</td>
                          <td className="py-2 font-medium">{formatBs(ganancia)}</td>
                          <td className="py-2 text-center" title={t.con_factura ? 'Facturado' : 'Sin facturar'}>
                            {t.con_factura ? '🧾' : '—'}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {isAdmin && (
                              <>
                                <button onClick={() => empezarEdicion(t)} className="text-brand-600 hover:underline text-xs mr-3">
                                  Editar
                                </button>
                                <button onClick={() => borrar(t.id, formatBs(t.monto))} className="text-red-500 hover:underline text-xs">
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
          )}
        </div>
      </div>
    </AppShell>
  );
}