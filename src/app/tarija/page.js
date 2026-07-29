'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const VACIO_CLIENTE = {
  codigo: '',
  nombre: '',
  telefono: '',
  dia_pago: '',
  plan: '',
  precio: '',
  velocidad: '',
  frecuencia: '',
  direccion: '',
};

export default function TarijaPage() {
  const [tab, setTab] = useState('cliente'); // 'cliente' | 'pago'

  return (
    <div className="min-h-screen bg-brand-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="JapTom Telecom" className="w-20 h-20 mx-auto mb-2" />
          <div className="font-display text-2xl font-bold text-brand-700">JapTom Telecom</div>
          <div className="text-brand-500 text-sm">Carga de datos — Sucursal Tarija</div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('cliente')}
            className={`flex-1 py-2 rounded-lg font-medium ${tab === 'cliente' ? 'bg-brand-500 text-white' : 'bg-white text-brand-600 border border-brand-200'}`}
          >
            + Cliente nuevo
          </button>
          <button
            onClick={() => setTab('pago')}
            className={`flex-1 py-2 rounded-lg font-medium ${tab === 'pago' ? 'bg-brand-500 text-white' : 'bg-white text-brand-600 border border-brand-200'}`}
          >
            💳 Registrar pago
          </button>
        </div>

        {tab === 'cliente' ? <FormClienteNuevo /> : <FormRegistrarPago />}

        <p className="text-xs text-brand-400 text-center mt-6">
          Este enlace es solo para cargar datos de la sucursal Tarija. No requiere usuario ni contraseña.
        </p>
      </div>
    </div>
  );
}

function FormClienteNuevo() {
  const [form, setForm] = useState(VACIO_CLIENTE);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setOk('');
    if (!form.codigo || !form.nombre) {
      setError('El ID y el nombre son obligatorios.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.from('clientes').insert({
      ...form,
      ciudad: 'Tarija',
      activo: true,
      dia_pago: form.dia_pago ? Number(form.dia_pago) : null,
      precio: form.precio ? Number(form.precio) : 0,
    });
    setEnviando(false);
    if (error) {
      setError('No se pudo guardar: ' + error.message);
      return;
    }
    setOk(`Cliente "${form.nombre}" (${form.codigo}) guardado correctamente.`);
    setForm(VACIO_CLIENTE);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-3">
      <div>
        <label className="label">ID Cliente *</label>
        <input className="input" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} placeholder="TJA00001" />
      </div>
      <div>
        <label className="label">Nombre *</label>
        <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      </div>
      <div>
        <label className="label">Teléfono</label>
        <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
      </div>
      <div>
        <label className="label">Día de pago</label>
        <input type="number" min="1" max="31" className="input" value={form.dia_pago} onChange={(e) => setForm({ ...form, dia_pago: e.target.value })} />
      </div>
      <div>
        <label className="label">Plan</label>
        <input className="input" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} placeholder="Ej: Plan Hogar" />
      </div>
      <div>
        <label className="label">Velocidad</label>
        <input className="input" value={form.velocidad} onChange={(e) => setForm({ ...form, velocidad: e.target.value })} />
      </div>
      <div>
        <label className="label">Precio (Bs)</label>
        <input type="number" step="0.01" className="input" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
      </div>
      <div>
        <label className="label">Dirección</label>
        <input className="input" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {ok && <p className="text-brand-600 text-sm">{ok}</p>}
      <button type="submit" disabled={enviando} className="btn-primary w-full">
        {enviando ? 'Guardando…' : 'Guardar cliente'}
      </button>
    </form>
  );
}

function FormRegistrarPago() {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');

  async function buscar(q) {
    setBusqueda(q);
    setSeleccionado(null);
    setOk('');
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    const { data } = await supabase
      .from('clientes')
      .select('id, codigo, nombre, precio')
      .eq('ciudad', 'Tarija')
      .ilike('nombre', `%${q}%`)
      .limit(8);
    setResultados(data || []);
  }

  async function registrar(e) {
    e.preventDefault();
    setError('');
    setOk('');
    if (!seleccionado || !monto) return;
    setEnviando(true);
    const { error } = await supabase.from('pagos').insert({
      cliente_id: seleccionado.id,
      fecha_pago: fecha,
      monto: Number(monto),
    });
    setEnviando(false);
    if (error) {
      setError('No se pudo registrar: ' + error.message);
      return;
    }
    setOk(`Pago de Bs ${monto} registrado para ${seleccionado.nombre}.`);
    setSeleccionado(null);
    setBusqueda('');
    setResultados([]);
    setMonto('');
  }

  return (
    <form onSubmit={registrar} className="card p-6 space-y-3">
      <div>
        <label className="label">Buscar cliente de Tarija</label>
        <input className="input" placeholder="Nombre del cliente…" value={busqueda} onChange={(e) => buscar(e.target.value)} />
        {resultados.length > 0 && !seleccionado && (
          <div className="border border-brand-100 rounded-lg mt-1 max-h-48 overflow-y-auto">
            {resultados.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  setSeleccionado(c);
                  setMonto(c.precio || '');
                  setBusqueda(c.nombre);
                  setResultados([]);
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-brand-50"
              >
                {c.nombre} <span className="text-brand-400 font-mono text-xs">({c.codigo})</span>
              </button>
            ))}
          </div>
        )}
        {seleccionado && <div className="text-xs text-brand-500 mt-1">Cliente: {seleccionado.codigo}</div>}
      </div>
      <div>
        <label className="label">Fecha</label>
        <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <div>
        <label className="label">Monto (Bs)</label>
        <input type="number" step="0.01" className="input" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {ok && <p className="text-brand-600 text-sm">{ok}</p>}
      <button type="submit" disabled={!seleccionado || enviando} className="btn-primary w-full">
        {enviando ? 'Registrando…' : 'Registrar pago'}
      </button>
    </form>
  );
}
