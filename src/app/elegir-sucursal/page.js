'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSucursalActiva } from '@/lib/useSucursalActiva';

export default function ElegirSucursalPage() {
  const { user, loading: cargandoAuth } = useAuth();
  const router = useRouter();
  const { esFija, elegir, listo } = useSucursalActiva();

  useEffect(() => {
    if (!cargandoAuth && !user) router.replace('/login');
  }, [cargandoAuth, user, router]);

  // Si el usuario tiene una sucursal fija asignada, no necesita elegir — directo al dashboard
  useEffect(() => {
    if (listo && esFija) router.replace('/dashboard');
  }, [listo, esFija, router]);

  function seleccionar(ciudad) {
    elegir(ciudad);
    router.replace('/dashboard');
  }

  if (cargandoAuth || !listo || esFija) {
    return (
      <div className="min-h-screen flex items-center justify-center text-brand-500">
        Cargando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-700 flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="JapTom Telecom" className="w-20 h-20 mx-auto mb-3" />
        <h1 className="font-display text-xl font-bold text-brand-800 mb-1">¿A qué sucursal quieres entrar?</h1>
        <p className="text-brand-500 text-sm mb-6">Puedes cambiarla más tarde desde el menú lateral.</p>

        <div className="space-y-3">
          <button onClick={() => seleccionar('El Alto')} className="btn-primary w-full py-3">
            📍 El Alto
          </button>
          <button onClick={() => seleccionar('Tarija')} className="btn-primary w-full py-3">
            📍 Tarija
          </button>
          <button onClick={() => seleccionar('Todas')} className="btn-secondary w-full py-3">
            🌎 Ver ambas sucursales juntas
          </button>
        </div>
      </div>
    </div>
  );
}
