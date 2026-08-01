'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { formatBs, linkWhatsApp, construirMensaje, parsearFechaLocal } from '@/lib/utils';
import { generarTicketFalla } from '@/lib/generarTicket';

export default function FichaClientePage() {
  const { codigo } = useParams();
  const router = useRouter();
  const { isAdmin } = usePerfil();
  const [cliente, setCliente] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [config, setConfig] = useState({});
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [nuevoPago, setNuevoPago] = useState({ fecha: new Date().toISOString().slice(0, 10), monto: '' });
  const [mostrarTicket, setMostrarTicket] = useState(false);
  const [motivoFalla, setMotivoFalla] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [mikrotikCargando, setMikrotikCargando] = useState(false);
  const [mikrotikMsg, setMikrotikMsg] = useState('');
  const [editandoPagoId, setEditandoPagoId] = useState(null);
  const [edicionPago, setEdicionPago] = useState({ fecha_pago: '', monto: '' });

  const cargar = useCallback(async () => {
    const { data: c } = await supabase.from('v_clientes_estado').select('*').eq('codigo', codigo).single();
    setCliente(c);
    setForm(c);
    if (c) {
      const { data: p } = await supabase
        .from('pagos')
        .select('*')
        .eq('cliente_id', c.id)
        .order('fecha_pago', { ascending: false });
      setPagos(p || []);
    }
    const { data: cfgRows } = await supabase.from('config').select('*');
    const cfg = {};
    (cfgRows || []).forEach((r) => (cfg[r.clave] = r.valor));
    setConfig(cfg);
  }, [codigo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarEdicion() {
    setGuardando(true);
    const { id, estado, pagado_mes_actual, created_at, ...actualizables } = form;
    const { error } = await supabase.from('clientes').update(actualizables).eq('id', id);
    setGuardando(false);
    if (!error) {
      setEditando(false);
      cargar();
    } else {
      setMsg('Error al guardar: ' + error.message);
    }
  }

  async function registrarPago(e) {
    e.preventDefault();
    if (!nuevoPago.monto) return;
    if (!confirm(`¿Confirmas registrar un pago de ${formatBs(nuevoPago.monto)} para ${cliente.nombre}?`)) return;
    setGuardando(true);
    const { error } = await supabase.from('pagos').insert({
      cliente_id: cliente.id,
      fecha_pago: nuevoPago.fecha,
      monto: Number(nuevoPago.monto),
    });
    setGuardando(false);
    if (!error) {
      setNuevoPago({ fecha: new Date().toISOString().slice(0, 10), monto: '' });
      setMsg(`✅ Pago de ${formatBs(nuevoPago.monto)} registrado correctamente.`);
      cargar();
    } else {
      setMsg('Error al registrar pago: ' + error.message);
    }
  }

  async function borrarPago(pagoId, montoTexto) {
    if (!confirm(`¿Borrar el pago de ${montoTexto}? Esta acción no se puede deshacer.`)) return;
    if (!confirm('Confirma una vez más: ¿SEGURO que quieres borrar este pago definitivamente?')) return;
    const { error } = await supabase.from('pagos').delete().eq('id', pagoId);
    if (error) {
      setMsg('Error al borrar pago: ' + error.message);
    } else {
      cargar();
    }
  }

  function empezarEdicionPago(p) {
    setEditandoPagoId(p.id);
    setEdicionPago({ fecha_pago: p.fecha_pago.slice(0, 10), monto: p.monto });
  }

  async function guardarEdicionPago(pagoId) {
    const { error } = await supabase
      .from('pagos')
      .update({ fecha_pago: edicionPago.fecha_pago, monto: Number(edicionPago.monto) })
      .eq('id', pagoId);
    if (error) {
      setMsg('Error al modificar pago: ' + error.message);
      return;
    }
    setEditandoPagoId(null);
    cargar();
  }

  async function borrarCliente() {
    if (
      !confirm(
        `¿Seguro que quieres BORRAR PERMANENTEMENTE a ${cliente.nombre} y todo su historial de pagos? Esta acción no se puede deshacer.\n\nSi solo quieres que deje de aparecer como activo, usa "Editar" y marca Activo: No en su lugar.`
      )
    )
      return;
    const confirmacion = prompt(
      `Para confirmar, escribe el ID del cliente (${cliente.codigo}) tal cual, en mayúsculas:`
    );
    if (confirmacion !== cliente.codigo) {
      alert('El ID no coincide. No se borró nada.');
      return;
    }
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id);
    if (error) {
      setMsg('Error al borrar cliente: ' + error.message);
    } else {
      router.push('/clientes');
    }
  }

  async function llamarMikrotik(ruta, body) {
    setMikrotikCargando(true);
    setMikrotikMsg('');
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const res = await fetch(`/api/mikrotik/${ruta}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion?.session?.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMikrotikMsg('❌ ' + (data.error || 'Ocurrió un error.'));
      } else {
        setMikrotikMsg('✅ ' + data.mensaje);
      }
    } catch (e) {
      setMikrotikMsg('❌ No se pudo conectar: ' + e.message);
    } finally {
      setMikrotikCargando(false);
    }
  }

  async function cortarServicio() {
    if (!confirm(`¿Cortar el servicio de internet de ${cliente.nombre} ahora mismo?`)) return;
    await llamarMikrotik('toggle', { clienteId: cliente.id, activar: false });
  }

  async function reactivarServicio() {
    await llamarMikrotik('toggle', { clienteId: cliente.id, activar: true });
  }

  async function sincronizarPlan() {
    await llamarMikrotik('cambiar-plan', { clienteId: cliente.id });
  }
async function cerrarSesionMikrotik() {
    if (!confirm(`¿Cerrar la sesión PPPoE activa de ${cliente.nombre}? El cliente se desconectará y su router/equipo intentará reconectarse solo.`)) return;
    await llamarMikrotik('cerrar-sesion', { clienteId: cliente.id });
  }

  async function crearUsuarioMikrotik() {
    if (!confirm(`¿Crear el usuario PPPoE "${cliente.pppoe_usuario}" en el MikroTik de ${cliente.ciudad}?`)) return;
    await llamarMikrotik('crear-usuario', { clienteId: cliente.id });
  }

  async function generarTicket() {
    if (!confirm(`¿Confirmas generar el ticket de falla para ${cliente.nombre}?`)) return;
    await generarTicketFalla(cliente, motivoFalla, config.empresa_nombre);
    setMostrarTicket(false);
    setMotivoFalla('');
  }

  if (!cliente) {
    return (
      <AppShell>
        <p className="text-brand-400">Cargando ficha de cliente…</p>
      </AppShell>
    );
  }

  const mensaje = construirMensaje(cliente, config, config.empresa_nombre);
  const wa = linkWhatsApp(cliente.telefono, mensaje);
  const totalHistorico = pagos.reduce((acc, p) => acc + Number(p.monto), 0);

  return (
    <AppShell>
      <button onClick={() => router.push('/clientes')} className="text-brand-500 text-sm mb-4">
        ← Volver a Clientes
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-brand-400 text-xs font-mono">{cliente.codigo}</div>
          <h1 className="font-display text-2xl font-bold text-brand-800">{cliente.nombre}</h1>
          <div className="mt-1">
            {!cliente.activo ? (
              <span className="badge-inactivo">Inactivo</span>
            ) : cliente.estado === 'Al día' ? (
              <span className="badge-al-dia">Al día</span>
            ) : (
              <span className="badge-vencido">Vencido</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn-whatsapp">
              📲 Enviar WhatsApp
            </a>
          )}
          <button onClick={() => setMostrarTicket((v) => !v)} className="btn-secondary">
            🎫 Ticket de falla
          </button>
          <button onClick={() => setEditando((v) => !v)} className="btn-secondary">
            {editando ? 'Cancelar' : 'Editar'}
          </button>
          {isAdmin && (
            <button onClick={borrarCliente} className="btn-secondary text-red-500 border-red-200 hover:bg-red-50">
              Eliminar
            </button>
          )}
        </div>
      </div>

      {msg && <div className="card p-3 mb-4 text-red-600 text-sm">{msg}</div>}

      {mostrarTicket && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-brand-700 mb-3">Generar ticket de falla</h2>
          <p className="text-sm text-brand-500 mb-3">
            Se incluirá automáticamente: ID, nombre, teléfono, dirección y plan del cliente. Solo describe el motivo.
          </p>
          <textarea
            className="input mb-3"
            rows={3}
            placeholder="Ej: Cliente reporta intermitencia en la señal desde ayer por la noche…"
            value={motivoFalla}
            onChange={(e) => setMotivoFalla(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={generarTicket} className="btn-primary">
              📄 Descargar PDF
            </button>
            <button onClick={() => setMostrarTicket(false)} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold text-brand-700 mb-3">Datos del cliente</h2>
            {!editando ? (
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-brand-500">Teléfono</dt>
                <dd>{cliente.telefono || '—'}</dd>
                <dt className="text-brand-500">Ciudad</dt>
                <dd>{cliente.ciudad || 'El Alto'}</dd>
                <dt className="text-brand-500">Día de pago</dt>
                <dd>{cliente.dia_pago ?? '—'}</dd>
                <dt className="text-brand-500">Plan</dt>
                <dd>{cliente.plan || '—'}</dd>
                <dt className="text-brand-500">Velocidad</dt>
                <dd>{cliente.velocidad || '—'}</dd>
                <dt className="text-brand-500">Frecuencia</dt>
                <dd>{cliente.frecuencia || '—'}</dd>
                <dt className="text-brand-500">Precio</dt>
                <dd>{formatBs(cliente.precio)}</dd>
                <dt className="text-brand-500">Dirección</dt>
                <dd>{cliente.direccion || '—'}</dd>
                <dt className="text-brand-500">Activo</dt>
                <dd>{cliente.activo ? 'Sí' : 'No'}</dd>
                <dt className="text-brand-500">Usuario PPPoE</dt>
                <dd>{cliente.pppoe_usuario || '—'}</dd>
 <dt className="text-brand-500">IP asignada</dt>
                <dd>{cliente.ip_asignada || '—'}</dd>
              </dl>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre</label>
                  <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.telefono || ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                </div>
                <div>
                  <label className="label">Ciudad</label>
                  <select className="input" value={form.ciudad || 'El Alto'} onChange={(e) => setForm({ ...form, ciudad: e.target.value })}>
                    <option value="El Alto">El Alto</option>
                    <option value="Tarija">Tarija</option>
                  </select>
                </div>
                <div>
                  <label className="label">Día de pago</label>
                  <input type="number" className="input" value={form.dia_pago || ''} onChange={(e) => setForm({ ...form, dia_pago: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Plan</label>
                  <input className="input" value={form.plan || ''} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
                </div>
                <div>
                  <label className="label">Velocidad</label>
                  <input className="input" value={form.velocidad || ''} onChange={(e) => setForm({ ...form, velocidad: e.target.value })} />
                </div>
                <div>
                  <label className="label">Frecuencia</label>
                  <input className="input" value={form.frecuencia || ''} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} />
                </div>
                <div>
                  <label className="label">Precio (Bs)</label>
                  <input type="number" className="input" value={form.precio || ''} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Activo</label>
                  <select className="input" value={form.activo ? 'si' : 'no'} onChange={(e) => setForm({ ...form, activo: e.target.value === 'si' })}>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="label">Usuario PPPoE</label>
                  <input className="input" value={form.pppoe_usuario || ''} onChange={(e) => setForm({ ...form, pppoe_usuario: e.target.value })} placeholder="Igual que en el MikroTik" />
                </div>
                <div>
                  <label className="label">Contraseña PPPoE</label>
                  <input className="input" value={form.pppoe_password || ''} onChange={(e) => setForm({ ...form, pppoe_password: e.target.value })} placeholder="Solo se usa para crearlo en el MikroTik" />
                </div>
 <div>
                  <label className="label">IP a asignar</label>
                  <input
                    className="input"
                    value={form.ip_asignada || ''}
                    onChange={(e) => setForm({ ...form, ip_asignada: e.target.value })}
                    placeholder="Ej: 10.1.20.4"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Dirección</label>
                  <input className="input" value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <button onClick={guardarEdicion} disabled={guardando} className="btn-primary">
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-brand-700 mb-3">Historial de pagos</h2>
            {pagos.length === 0 ? (
              <p className="text-brand-400 text-sm">Aún no hay pagos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-brand-500 border-b border-brand-100">
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Monto</th>
                    {isAdmin && <th className="py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className="border-b border-brand-50">
                      {editandoPagoId === p.id ? (
                        <>
                          <td className="py-2">
                            <input
                              type="date"
                              className="input"
                              value={edicionPago.fecha_pago}
                              onChange={(e) => setEdicionPago({ ...edicionPago, fecha_pago: e.target.value })}
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={edicionPago.monto}
                              onChange={(e) => setEdicionPago({ ...edicionPago, monto: e.target.value })}
                            />
                          </td>
                          {isAdmin && (
                            <td className="py-2 text-right whitespace-nowrap">
                              <button onClick={() => guardarEdicionPago(p.id)} className="text-brand-600 hover:underline text-xs mr-2">
                                Guardar
                              </button>
                              <button onClick={() => setEditandoPagoId(null)} className="text-brand-400 hover:underline text-xs">
                                Cancelar
                              </button>
                            </td>
                          )}
                        </>
                      ) : (
                        <>
                          <td className="py-2">{parsearFechaLocal(p.fecha_pago).toLocaleDateString('es-BO')}</td>
                          <td className="py-2">{formatBs(p.monto)}</td>
                          {isAdmin && (
                            <td className="py-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => empezarEdicionPago(p)}
                                className="text-brand-600 hover:underline text-xs mr-3"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => borrarPago(p.id, formatBs(p.monto))}
                                className="text-red-500 hover:underline text-xs"
                              >
                                Borrar
                              </button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 text-sm text-brand-600 font-medium">
              Total histórico pagado: {formatBs(totalHistorico)} · {pagos.length} pagos
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold text-brand-700 mb-3">Registrar pago</h2>
            <form onSubmit={registrarPago} className="space-y-3">
              <div>
                <label className="label">Fecha</label>
                <input
                  type="date"
                  className="input"
                  value={nuevoPago.fecha}
                  onChange={(e) => setNuevoPago({ ...nuevoPago, fecha: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Monto (Bs)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder={cliente.precio}
                  value={nuevoPago.monto}
                  onChange={(e) => setNuevoPago({ ...nuevoPago, monto: e.target.value })}
                />
              </div>
              <button type="submit" disabled={guardando} className="btn-primary w-full">
                {guardando ? 'Registrando…' : 'Registrar pago'}
              </button>
            </form>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-brand-700 mb-3">Vista previa del mensaje</h2>
            <p className="text-sm text-brand-600 whitespace-pre-wrap bg-brand-50 rounded-lg p-3">{mensaje}</p>
          </div>

          {isAdmin && (
            <div className="card p-5">
              <h2 className="font-semibold text-brand-700 mb-3">Control de servicio (MikroTik)</h2>
              {!cliente.pppoe_usuario ? (
                <p className="text-sm text-brand-400">
                  Este cliente no tiene un "Usuario PPPoE" configurado — agrégalo en "Editar" para poder
                  activarlo/cortarlo desde aquí.
                </p>
              ) : (
                <div className="space-y-2">
                  {cliente.pppoe_password && (
                    <button onClick={crearUsuarioMikrotik} disabled={mikrotikCargando} className="btn-secondary w-full">
                      ➕ Crear usuario en MikroTik
                    </button>
                  )}
                  <button onClick={reactivarServicio} disabled={mikrotikCargando} className="btn-secondary w-full">
                    ▶️ Reactivar servicio
                  </button>
                  <button
                    onClick={cortarServicio}
                    disabled={mikrotikCargando}
                    className="btn-secondary w-full text-red-500 border-red-200 hover:bg-red-50"
                  >
                    ⛔ Cortar servicio
                  </button>
                  <button onClick={sincronizarPlan} disabled={mikrotikCargando} className="btn-secondary w-full">
                    🔄 Sincronizar plan al MikroTik
                  </button>
<button
                    onClick={cerrarSesionMikrotik}
                    disabled={mikrotikCargando}
                    className="btn-secondary w-full text-orange-600 border-orange-200 hover:bg-orange-50"
                  >
                    🔌 Cerrar sesión activa
                  </button>
                </div>
              )}
              {mikrotikMsg && <p className="text-sm mt-3">{mikrotikMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
