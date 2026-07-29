'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Correo o contraseña incorrectos.');
      return;
    }
    router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-700 px-4">
      <form onSubmit={handleSubmit} className="card p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="JapTom Telecom" className="w-20 h-20 mx-auto mb-2" />
          <div className="font-display text-2xl font-bold text-brand-700">JapTom Telecom</div>
          <div className="text-brand-500 text-sm">Panel de gestión (CRM)</div>
        </div>
        <label className="label">Correo</label>
        <input
          type="email"
          required
          className="input mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@japtom.com"
        />
        <label className="label">Contraseña</label>
        <input
          type="password"
          required
          className="input mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="text-xs text-brand-400 mt-4 text-center">
          Los usuarios se crean desde el panel de Supabase (Authentication → Users).
        </p>
      </form>
    </div>
  );
}
