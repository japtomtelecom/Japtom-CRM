'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { formatBs } from '@/lib/utils';

const VACIO = { nombre: '', velocidad: '', frecuencia: 'Mensual', precio: '', perfil_mikrotik: '' };

export default function PlanesPage() {
  const { isAdmin } = usePerfil();
  const [planes, setPlanes] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');

  async function cargar() {
    const { data } = await supabase.from('planes').select('*').order('precio', { ascending: true });
    setPlanes(data || []);
  }

  useEffect(() => {
    cargar();
  }, []);

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
    setForm(VACIO);
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
      <h1 className="font-display text-2xl font-bold text-brand-800 mb-6">Planes</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {isAdmin && (
          <form onSubmit={guardar} className="card p-5 space-y-3 h-fit">
            <h2 className="font-semibold text-brand-700">{editId ? 'Editar plan' : 'Nuevo plan'}</h2>
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
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
                <th className="py-2">Velocidad</th>
                <th className="py-2">Frecuencia</th>
                <th className="py-2">Precio</th>
                <th className="py-2">Perfil MikroTik</th>
                {isAdmin && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {planes.map((p) => (
                <tr key={p.id} className="border-b border-brand-50">
                  <td className="py-2 font-medium">{p.nombre}</td>
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
                          setForm({ nombre: p.nombre, velocidad: p.velocidad || '', frecuencia: p.frecuencia || 'Mensual', precio: p.precio, perfil_mikrotik: p.perfil_mikrotik || '' });
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
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
