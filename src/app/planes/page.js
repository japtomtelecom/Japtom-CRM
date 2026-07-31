'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
import { formatBs } from '@/lib/utils';

const VACIO = { nombre: '', velocidad: '', frecuencia: 'Mensual', precio: '', perfil_mikrotik: '', ciudad: 'El Alto' };

export default function PlanesPage() {
  const { isAdmin } = usePerfil();
  const { sucursalActiva, esFija } = useSucursalActiva();
  const [planes, setPlanes] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');
  const [ciudadFiltro, setCiudadFiltro] = useState('todas');

  useEffect(() => {
    if (sucursalActiva) setCiudadFiltro(sucursalActiva === 'Todas' ? 'todas' : sucursalActiva);
  }, [sucursalActiva]);

  useEffect(() => {
    // El formulario de "nuevo plan" arranca con la ciudad activa por defecto
    if (sucursalActiva && sucursalActiva !== 'Todas') {
      setForm((f) => ({ ...f, ciudad: sucursalActiva }));
    }
  }, [sucursalActiva]);

  async function cargar() {
    const { data } = await supabase.from('planes').select('*').order('precio', { ascending: true });
    setPlanes(data || []);
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = ciudadFiltro === 'todas' ? planes : planes.filter((p) => p.ciudad === ciudadFiltro);

  async function guardar(e) {
    e.preventDefault();
    setMsg('');
    const payload = { ...form, precio: Number(form.precio) };
    let error;
    if (editId) {
      ({ error } = await supabase.from('planes').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('planes').insert(payload));
    }
    if (error) {
      setMsg('Error: ' + error.message);
      return;
    }
    setForm({ ...VACIO, ciudad: sucursalActiva && sucursalActiva !== 'Todas' ? sucursalActiva : 'El Alto' });
    setEditId(null);
    cargar();
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este plan del catálogo? Los clientes que ya lo tienen asignado no se ven afectados.')) return;
    await supabase.from('planes').delete().eq('id', id);
    cargar();
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-800">Planes</h1>
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
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {isAdmin && (
          <form onSubmit={guardar} className="card p-5 space-y-3 h-fit">
            <h2 className="font-semibold text-brand-700">{editId ? 'Editar plan' : 'Nuevo plan'}</h2>
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <label className="label">Ciudad / Sucursal</label>
              <select className="input" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} required>
                <option value="El Alto">El Alto</option>
                <option value="Tarija">Tarija</option>
              </select>
            </div>
            <div>
              <label className="label">Velocidad</label>
              <input className="input" placeholder="60 Mbps" value={form.velocidad} onChange={(e) => setForm({ ...form, velocidad: e.target.value })} />
            </div>
            <div>
              <label className="label">Frecuencia</label>
              <select className="input" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}>
                <option>Mensual</option>
                <option>Trimestral</option>
                <option>Semestral</option>
                <option>Anual</option>
              </select>
            </div>
            <div>
              <label className="label">Precio (Bs)</label>
              <input type="number" step="0.01" className="input" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
            </div>
            <div>
              <label className="label">Perfil MikroTik (opcional)</label>
              <input
                className="input"
                placeholder="Nombre exacto del perfil PPP en tu router"
                value={form.perfil_mikrotik || ''}
                onChange={(e) => setForm({ ...form, perfil_mikrotik: e.target.value })}
              />
            </div>
            {msg && <p className="text-red-600 text-sm">{msg}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {editId ? 'Guardar cambios' : 'Agregar plan'}
              </button>
              {editId && (
                <button type="button" className="btn-secondary" onClick={() => { setForm(VACIO); setEditId(null); }}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}

        <div className={`card p-5 ${isAdmin ? 'md:col-span-2' : 'md:col-span-3'}`}>
          {!isAdmin && (
            <p className="text-brand-400 text-sm mb-3">
              Solo un administrador puede agregar, editar o eliminar planes del catálogo.
            </p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 border-b border-brand-100">
                <th className="py-2">Plan</th>
                <th className="py-2">Ciudad</th>
                <th className="py-2">Velocidad</th>
                <th className="py-2">Frecuencia</th>
                <th className="py-2">Precio</th>
                <th className="py-2">Perfil MikroTik</th>
                {isAdmin && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b border-brand-50">
                  <td className="py-2 font-medium">{p.nombre}</td>
                  <td className="py-2">{p.ciudad || 'El Alto'}</td>
                  <td className="py-2">{p.velocidad}</td>
                  <td className="py-2">{p.frecuencia}</td>
                  <td className="py-2">{formatBs(p.precio)}</td>
                  <td className="py-2 text-brand-400">{p.perfil_mikrotik || '—'}</td>
                  {isAdmin && (
                    <td className="py-2 text-right space-x-3">
                      <button
                        className="text-brand-600 hover:underline"
                        onClick={() => {
                          setEditId(p.id);
                          setForm({
                            nombre: p.nombre,
                            velocidad: p.velocidad || '',
                            frecuencia: p.frecuencia || 'Mensual',
                            precio: p.precio,
                            perfil_mikrotik: p.perfil_mikrotik || '',
                            ciudad: p.ciudad || 'El Alto',
                          });
                        }}
                      >
                        Editar
                      </button>
                      <button className="text-red-500 hover:underline" onClick={() => eliminar(p.id)}>
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-4 text-brand-400">
                    No hay planes para esta ciudad todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}