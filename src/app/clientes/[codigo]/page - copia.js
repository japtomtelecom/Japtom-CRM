'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { formatBs, linkWhatsApp, construirMensaje } from '@/lib/utils';
import { generarContrato } from '@/lib/generarContrato';
import { generarBoletaInstalacion } from '@/lib/generarBoleta';

function ModalBoleta({ cliente, empresaNombre, onClose }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState('Puerto óptico en NAP: ');
  const [generando, setGenerando] = useState(false);

  async function generar() {
    setGenerando(true);
    await generarBoletaInstalacion(cliente, fecha, observaciones, empresaNombre);
    setGenerando(false);
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Boleta de instalación</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: -8 }}>{cliente.nombre} · {cliente.codigo}</p>

        <label className="label" style={{ marginTop: 12 }}>Fecha</label>
        <input
          type="date"
          className="input"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <p style={{ fontSize: 12, color: '#888', marginTop: 12 }}>
          Los materiales (Fibra drop, ONT, Tensores plásticos, etc.) salen en la boleta con un espacio en blanco para que el técnico anote la cantidad a mano.
        </p>

        <label className="label" style={{ marginTop: 12 }}>Observaciones</label>
        <textarea
          className="input"
          rows={3}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />

        <div className="flex gap-2 mt-4">
          <button onClick={generar} disabled={generando} className="btn-primary">
            {generando ? 'Generando…' : 'Generar PDF'}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelMikrotik({ cliente, onRecargar }) {
  const [accionEnCurso, setAccionEnCurso] = useState(null);
  const [resultado, setResultado] = useState(null);

  async function ejecutar(accion, endpoint, activar) {
    setAccionEnCurso(accion);
    setResultado(null);
    try {
      const body = endpoint === 'toggle' ? { clienteId: cliente.id, activar } : { clienteId: cliente.id };
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/mikrotik/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error desconocido.');
      setResultado({ ok: true, mensaje: json.mensaje });
      onRecargar?.(true);
    } catch (e) {
      setResultado({ ok: false, error: e.message });
    } finally {
      setAccionEnCurso(null);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-brand-700 mb-3">Control MikroTik</h2>

      {!cliente.pppoe_usuario && (
        <p className="text-xs text-amber-600 mb-3">
          Este cliente no tiene "Usuario PPPoE" configurado. Completalo en "Editar" antes de usar estas acciones.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => ejecutar('crear', 'crear-usuario')}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
        >
          {accionEnCurso === 'crear' ? 'Creando…' : '➕ Crear usuario'}
        </button>
        <button
          onClick={() => ejecutar('plan', 'cambiar-plan')}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
        >
          {accionEnCurso === 'plan' ? 'Aplicando…' : '🔄 Sincronizar plan'}
        </button>
        <button
          onClick={() => ejecutar('bloquear', 'toggle', false)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
          style={{ color: '#791F1F' }}
        >
          {accionEnCurso === 'bloquear' ? 'Bloqueando…' : '🔒 Bloquear servicio'}
        </button>
        <button
          onClick={() => ejecutar('reactivar', 'toggle', true)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
          style={{ color: '#085041' }}
        >
          {accionEnCurso === 'reactivar' ? 'Reactivando…' : '🔓 Reactivar servicio'}
        </button>
        <button
          onClick={() => ejecutar('cerrar', 'cerrar-sesion')}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm col-span-2"
        >
          {accionEnCurso === 'cerrar' ? 'Cerrando…' : '⏏️ Cerrar sesión activa (forzar reinicio)'}
        </button>
      </div>

      {resultado && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            background: resultado.ok ? '#E1F5EE' : '#FCEBEB',
            color: resultado.ok ? '#085041' : '#791F1F',
          }}
        >
          {resultado.ok ? '✅ ' : '⚠️ '}
          {resultado.ok ? resultado.mensaje : resultado.error}
        </div>
      )}
    </div>
  );
}

export default function FichaClientePage() {
  const params = useParams();
  const { isAdmin } = usePerfil();
  const codigo = params.codigo;

  const [cliente, setCliente] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [mostrarBoleta, setMostrarBoleta] = useState(false);
  const [generandoContrato, setGenerandoContrato] = useState(false);

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true);
    const { data: c } = await supabase
      .from('v_clientes_estado')
      .select('*')
      .eq('codigo', codigo)
      .single();
    setCliente(c || null);
    setForm(c || null);

    if (c) {
      const { data: pagosData } = await supabase
        .from('pagos')
        .select('id, fecha_pago, monto, tipo_pago, mes_corresponde, meses_cubiertos')
        .eq('cliente_id', c.id)
        .order('fecha_pago', { ascending: false });
      setPagos(pagosData || []);
    }

    const { data: cfgRows } = await supabase.from('config').select('*');
    const cfg = {};
    (cfgRows || []).forEach((r) => (cfg[r.clave] = r.valor));
    setConfig(cfg);

    setLoading(false);
  }

  useEffect(() => {
    if (codigo) cargar();
  }, [codigo]);

  async function guardar() {
    if (!form) return;
    setGuardando(true);
    setMsg('');
    const { error } = await supabase
      .from('clientes')
      .update({
        nombre: form.nombre,
        telefono: form.telefono,
        ciudad: form.ciudad,
        dia_pago: form.dia_pago ? Number(form.dia_pago) : null,
        activo: form.activo,
        plan: form.plan,
        frecuencia: form.frecuencia,
        precio: form.precio ? Number(form.precio) : 0,
        velocidad: form.velocidad,
        direccion: form.direccion,
        ci: form.ci,
        costo_instalacion: form.costo_instalacion ? Number(form.costo_instalacion) : 0,
        pppoe_usuario: form.pppoe_usuario,
        pppoe_password: form.pppoe_password,
        ip_asignada: form.ip_asignada,
        nit: form.nit,
        factura: form.factura,
        correo_electronico: form.correo_electronico,
      })
      .eq('id', cliente.id);
    setGuardando(false);
    if (error) {
      setMsg('Error al guardar: ' + error.message);
      return;
    }
    setMsg('Cambios guardados correctamente.');
    setEditando(false);
    cargar();
  }

  async function handleGenerarContrato() {
    setGenerandoContrato(true);
    await generarContrato(cliente, config.empresa_nombre);
    setGenerandoContrato(false);
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-brand-500">Cargando ficha…</p>
      </AppShell>
    );
  }

  if (!cliente) {
    return (
      <AppShell>
        <p className="text-brand-500">No se encontró el cliente {codigo}.</p>
        <Link href="/clientes" className="text-brand-600 hover:underline">
          ← Volver a Clientes
        </Link>
      </AppShell>
    );
  }

  const mensaje = construirMensaje(cliente, config, config.empresa_nombre);
  const wa = linkWhatsApp(cliente.telefono, mensaje);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/clientes" className="text-brand-500 text-sm hover:underline">
            ← Volver a Clientes
          </Link>
          <h1 className="font-display text-2xl font-bold text-brand-800 mt-1">{cliente.nombre}</h1>
          <p className="text-brand-500 text-sm font-mono">{cliente.codigo}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn-whatsapp">
              📲 WhatsApp
            </a>
          )}
          <button onClick={handleGenerarContrato} disabled={generandoContrato} className="btn-secondary">
            {generandoContrato ? 'Generando…' : '📄 Generar contrato'}
          </button>
          <button onClick={() => setMostrarBoleta(true)} className="btn-secondary">
            🧾 Boleta de instalación
          </button>
          {isAdmin && !editando && (
            <button onClick={() => setEditando(true)} className="btn-primary">
              ✏️ Editar
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="card p-5 md:col-span-2">
          <h2 className="font-semibold text-brand-700 mb-3">Datos del cliente</h2>

          {!editando ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-brand-400">Teléfono</span>
                <p className="font-medium">{cliente.telefono || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Ciudad</span>
                <p className="font-medium">{cliente.ciudad || 'El Alto'}</p>
              </div>
              <div>
                <span className="text-brand-400">Día de pago</span>
                <p className="font-medium">{cliente.dia_pago ?? '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Estado</span>
                <p className="font-medium">{cliente.activo ? cliente.estado : 'Inactivo'}</p>
              </div>
              <div>
                <span className="text-brand-400">Plan</span>
                <p className="font-medium">{cliente.plan || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Frecuencia</span>
                <p className="font-medium">{cliente.frecuencia || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Precio</span>
                <p className="font-medium">{formatBs(cliente.precio)}</p>
              </div>
              <div>
                <span className="text-brand-400">Velocidad</span>
                <p className="font-medium">{cliente.velocidad || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Dirección</span>
                <p className="font-medium">{cliente.direccion || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">CI</span>
                <p className="font-medium">{cliente.ci || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Costo de instalación</span>
                <p className="font-medium">{formatBs(cliente.costo_instalacion || 0)}</p>
              </div>
              <div>
                <span className="text-brand-400">Activo</span>
                <p className="font-medium">{cliente.activo ? 'Sí' : 'No'}</p>
              </div>
              <div>
                <span className="text-brand-400">Factura</span>
                <p className="font-medium">{cliente.factura ? 'Sí' : 'No'}</p>
              </div>
              <div>
                <span className="text-brand-400">NIT</span>
                <p className="font-medium">{cliente.nit || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Correo electrónico</span>
                <p className="font-medium">{cliente.correo_electronico || '—'}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
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
                <input type="number" min="1" max="31" className="input" value={form.dia_pago ?? ''} onChange={(e) => setForm({ ...form, dia_pago: e.target.value })} />
              </div>
              <div>
                <label className="label">Plan</label>
                <input className="input" value={form.plan || ''} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
              </div>
              <div>
                <label className="label">Frecuencia</label>
                <input className="input" value={form.frecuencia || ''} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} />
              </div>
              <div>
                <label className="label">Precio (Bs)</label>
                <input type="number" step="0.01" className="input" value={form.precio ?? ''} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
              </div>
              <div>
                <label className="label">Velocidad</label>
                <input className="input" value={form.velocidad || ''} onChange={(e) => setForm({ ...form, velocidad: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Dirección</label>
                <input className="input" value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
              </div>
              <div>
                <label className="label">CI</label>
                <input className="input" value={form.ci || ''} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
              </div>
              <div>
                <label className="label">Costo de instalación (Bs)</label>
                <input type="number" step="0.01" className="input" value={form.costo_instalacion ?? ''} onChange={(e) => setForm({ ...form, costo_instalacion: e.target.value })} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={!!form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                <label htmlFor="activo" className="text-sm">Cliente activo</label>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="factura"
                  checked={!!form.factura}
                  onChange={(e) => setForm({ ...form, factura: e.target.checked })}
                />
                <label htmlFor="factura" className="text-sm">Requiere factura</label>
              </div>
              <div>
                <label className="label">NIT</label>
                <input className="input" value={form.nit || ''} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
              </div>
              <div>
                <label className="label">Correo electrónico</label>
                <input type="email" className="input" value={form.correo_electronico || ''} onChange={(e) => setForm({ ...form, correo_electronico: e.target.value })} />
              </div>

              {msg && <p className="col-span-2 text-sm text-brand-600">{msg}</p>}

              <div className="col-span-2 flex gap-2 mt-2">
                <button onClick={guardar} disabled={guardando} className="btn-primary">
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => {
                    setForm(cliente);
                    setEditando(false);
                    setMsg('');
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-1 space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold text-brand-700 mb-3">Configuración MikroTik</h2>

            {!editando ? (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-brand-400">Usuario PPPoE</span>
                  <p className="font-mono font-medium">{cliente.pppoe_usuario || '—'}</p>
                </div>
                <div>
                  <span className="text-brand-400">Contraseña PPPoE</span>
                  <p className="font-mono font-medium flex items-center gap-2">
                    {cliente.pppoe_password
                      ? verPassword
                        ? cliente.pppoe_password
                        : '•'.repeat(Math.min(cliente.pppoe_password.length, 10))
                      : '—'}
                    {cliente.pppoe_password && (
                      <button
                        type="button"
                        onClick={() => setVerPassword(!verPassword)}
                        className="text-brand-500 text-xs hover:underline font-sans"
                      >
                        {verPassword ? 'Ocultar' : 'Ver'}
                      </button>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-brand-400">IP asignada</span>
                  <p className="font-mono font-medium">{cliente.ip_asignada || '—'}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Usuario PPPoE</label>
                  <input className="input" value={form.pppoe_usuario || ''} onChange={(e) => setForm({ ...form, pppoe_usuario: e.target.value })} />
                </div>
                <div>
                  <label className="label">Contraseña PPPoE</label>
                  <input className="input" value={form.pppoe_password || ''} onChange={(e) => setForm({ ...form, pppoe_password: e.target.value })} />
                </div>
                <div>
                  <label className="label">IP asignada</label>
                  <input className="input" value={form.ip_asignada || ''} onChange={(e) => setForm({ ...form, ip_asignada: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {isAdmin && !editando && <PanelMikrotik cliente={cliente} onRecargar={cargar} />}

          <div className="card p-5">
            <h2 className="font-semibold text-brand-700 mb-3">Historial de pagos</h2>
            {pagos.length === 0 ? (
              <p className="text-sm text-brand-400">Sin pagos registrados.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {pagos.map((p) => (
                  <li key={p.id} className="border-b border-brand-50 pb-2">
                    <div className="flex justify-between">
                      <span>{new Date(p.fecha_pago).toLocaleDateString('es-BO')}</span>
                      <span className="font-medium">{formatBs(p.monto)}</span>
                    </div>
                    <div className="text-xs text-brand-400">
                      {p.tipo_pago || 'Mensual'}
                      {p.mes_corresponde
                        ? ' · ' + new Date(p.mes_corresponde).toLocaleDateString('es-BO', { month: 'short', year: 'numeric' })
                        : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {mostrarBoleta && (
        <ModalBoleta cliente={cliente} empresaNombre={config.empresa_nombre} onClose={() => setMostrarBoleta(false)} />
      )}
    </AppShell>
  );
}