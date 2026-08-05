'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { formatBs, linkWhatsApp, construirMensaje } from '@/lib/utils';

export default function FichaClientePage() {
  const params = useParams();
  const router = useRouter();
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

  async function cargar() {
    setLoading(true);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/clientes" className="text-brand-500 text-sm hover:underline">
            ← Volver a Clientes
          </Link>
          <h1 className="font-display text-2xl font-bold text-brand-800 mt-1">{cliente.nombre}</h1>
          <p className="text-brand-500 text-sm font-mono">{cliente.codigo}</p>
        </div>
        <div className="flex gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn-whatsapp">
              📲 WhatsApp
            </a>
          )}
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

        <div className="card p-5 md:col-span-1">
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
    </AppShell>
  );
}