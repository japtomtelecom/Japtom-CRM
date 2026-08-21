'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { useSucursalActiva } from '@/lib/useSucursalActiva';

export default function NuevoClientePage() {
  const router = useRouter();
  const { sucursalActiva, esFija } = useSucursalActiva();
  const [planes, setPlanes] = useState([]);
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    telefono: '',
    ci: '',
    costo_instalacion: '',
    dia_pago: '',
    activo: true,
    plan: '',
    frecuencia: '',
    precio: '',
    velocidad: '',
    direccion: '',
    ciudad: 'El Alto',
    pppoe_usuario: '',
    pppoe_password: '',
    ip_asignada: '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from('planes')
      .select('*')
      .then(({ data }) => setPlanes(data || []));
  }, []);

  useEffect(() => {
    if (sucursalActiva && sucursalActiva !== 'Todas') {
      setForm((f) => ({ ...f, ciudad: sucursalActiva }));
    }
  }, [sucursalActiva]);

  function aplicarPlan(nombrePlan) {
    const p = planes.find((pl) => pl.nombre === nombrePlan);
    if (p) {
      setForm((f) => ({ ...f, plan: p.nombre, velocidad: p.velocidad, frecuencia: p.frecuencia, precio: p.precio }));
    } else {
      setForm((f) => ({ ...f, plan: nombrePlan }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.codigo || !form.nombre) {
      setError('El ID y el nombre son obligatorios.');
      return;
    }
    if (!confirm(`¿Confirmas guardar al cliente "${form.nombre}" (${form.codigo})?`)) return;
    setGuardando(true);
    const { error } = await supabase.from('clientes').insert({
      ...form,
      dia_pago: form.dia_pago ? Number(form.dia_pago) : null,
      precio: form.precio ? Number(form.precio) : 0,
      costo_instalacion: form.costo_instalacion ? Number(form.costo_instalacion) : null,
    });
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/clientes/${form.codigo}`);
  }

  return (
    <AppShell>
      <button onClick={() => router.push('/clientes')} className="text-brand-500 text-sm mb-4">
        ← Volver a Clientes
      </button>
      <h1 className="font-display text-2xl font-bold text-brand-800 mb-6">Agregar cliente nuevo</h1>

      <form onSubmit={handleSubmit} className="card p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">ID Cliente *</label>
            <input
              className="input"
              placeholder="CSB00398"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label">Ciudad</label>
            {esFija ? (
              <div className="input bg-brand-50 text-brand-600">📍 {form.ciudad}</div>
            ) : (
              <select className="input" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })}>
                <option value="El Alto">El Alto</option>
                <option value="Tarija">Tarija</option>
              </select>
            )}
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <div>
            <label className="label">CI (Cédula de identidad)</label>
            <input className="input" value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value.toUpperCase() })} placeholder="Ej: 3321656 LP" />
          </div>
          <div>
            <label className="label">Costo de instalación (Bs)</label>
            <input type="number" className="input" value={form.costo_instalacion} onChange={(e) => setForm({ ...form, costo_instalacion: e.target.value })} placeholder="200" />
          </div>
          <div>
            <label className="label">Día de pago</label>
            <input type="number" min="1" max="31" className="input" value={form.dia_pago} onChange={(e) => setForm({ ...form, dia_pago: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Plan</label>
            <select className="input" value={form.plan} onChange={(e) => aplicarPlan(e.target.value)}>
              <option value="">— Selecciona un plan (o escribe uno personalizado abajo) —</option>
              {planes.map((p) => (
                <option key={p.id} value={p.nombre}>
                  {p.nombre} ({p.velocidad}, Bs {p.precio})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Velocidad</label>
            <input className="input" value={form.velocidad} onChange={(e) => setForm({ ...form, velocidad: e.target.value })} />
          </div>
          <div>
            <label className="label">Frecuencia</label>
            <input className="input" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} placeholder="Mensual / Semestral" />
          </div>
          <div>
            <label className="label">Precio (Bs)</label>
            <input type="number" step="0.01" className="input" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
          </div>
          <div>
            <label className="label">Activo</label>
            <select className="input" value={form.activo ? 'si' : 'no'} onChange={(e) => setForm({ ...form, activo: e.target.value === 'si' })}>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Dirección</label>
            <input className="input" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label">Usuario PPPoE (opcional)</label>
            <input
              className="input"
              value={form.pppoe_usuario}
              onChange={(e) => setForm({ ...form, pppoe_usuario: e.target.value.toLowerCase() })}
              placeholder="Igual que en el MikroTik"
            />
          </div>
          <div>
            <label className="label">Contraseña PPPoE (opcional)</label>
            <input
              className="input"
              value={form.pppoe_password}
              onChange={(e) => setForm({ ...form, pppoe_password: e.target.value.toLowerCase() })}
              placeholder="Solo se usa para crearlo en el MikroTik"
            />
          </div>
          <div>
            <label className="label">IP a asignar (opcional)</label>
            <input
              className="input"
              value={form.ip_asignada}
              onChange={(e) => setForm({ ...form, ip_asignada: e.target.value })}
              placeholder="Ej: 10.1.20.4"
            />
          </div>
        </div>

        <p className="text-xs text-brand-400 -mt-2">
          Si completas Usuario y Contraseña PPPoE, después de guardar podrás crear este usuario directo en tu
          MikroTik desde la ficha del cliente.
        </p>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={guardando} className="btn-primary">
          {guardando ? 'Guardando…' : 'Guardar cliente'}
        </button>
      </form>
    </AppShell>
  );
}