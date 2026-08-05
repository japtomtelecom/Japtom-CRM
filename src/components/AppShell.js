'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { usePerfil } from '@/lib/usePerfil';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
import { useAutoLogout } from '@/lib/useAutoLogout';
import { supabase } from '@/lib/supabaseClient';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/clientes', label: 'Clientes', icon: '👥' },
  { href: '/pagos', label: 'Pagos', icon: '💳' },
  { href: '/pagos/mensual', label: 'Registro mensual', icon: '📅' },
  { href: '/tickets', label: 'Tickets', icon: '🎫' },
  { href: '/estadisticas', label: 'Estadísticas', icon: '📈' },
  { href: '/planes', label: 'Planes', icon: '📶' },
  { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
];

export default function AppShell({ children }) {
  const { user, loading } = useAuth();
  const { isAdmin } = usePerfil();
  const { sucursalActiva, esFija, listo, olvidar } = useSucursalActiva();
  const router = useRouter();
  const pathname = usePathname();

  useAutoLogout(20); // cierra sesión sola tras 20 min sin actividad

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Usuario "Todas" sin sucursal elegida todavía → mandarlo a elegir
  useEffect(() => {
    if (user && listo && !esFija && !sucursalActiva) {
      router.replace('/elegir-sucursal');
    }
  }, [user, listo, esFija, sucursalActiva, router]);

  if (loading || (user && !listo)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-brand-500">
        Cargando…
      </div>
    );
  }

  if (!user) return null;
  if (!esFija && !sucursalActiva) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-56 bg-brand-700 text-white flex flex-col md:flex-col shrink-0">
        {/* Barra superior SOLO en celular: logo + selector de ciudad + cerrar sesión siempre visibles */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="w-7 h-7 shrink-0" />
            <span className="font-display font-bold text-sm shrink-0">JapTom</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {esFija ? (
              <span className="text-sm font-semibold bg-brand-600 px-3 py-1.5 rounded-lg">
                📍 {sucursalActiva}
              </span>
            ) : (
              <button
                onClick={() => {
                  olvidar();
                  router.push('/elegir-sucursal');
                }}
                className="text-sm font-semibold bg-brand-600 hover:bg-brand-500 px-3 py-1.5 rounded-lg"
              >
                📍 {sucursalActiva === 'Todas' ? 'Ambas' : sucursalActiva}
              </button>
            )}
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs bg-brand-600 hover:bg-brand-500 px-3 py-1.5 rounded-lg"
            >
              🚪 Salir
            </button>
          </div>
        </div>

        <div className="p-4 hidden md:flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="w-9 h-9" />
          <div>
            <div className="font-display text-xl font-bold leading-tight">JapTom</div>
            <div className="text-brand-200 text-xs">CRM Telecom</div>
          </div>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible flex-1">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap ${
                  active ? 'bg-brand-600 font-semibold' : 'hover:bg-brand-600/60'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-2 text-xs text-brand-200 hidden md:block">
          {user.email} · {isAdmin ? 'Administrador' : 'Cobrador'}
        </div>
        <div className="px-4 py-3 hidden md:block">
          {esFija ? (
            <span className="block text-center text-sm font-semibold bg-brand-600 px-3 py-2 rounded-lg">
              📍 {sucursalActiva}
            </span>
          ) : (
            <button
              onClick={() => {
                olvidar();
                router.push('/elegir-sucursal');
              }}
              className="w-full text-center text-sm font-semibold bg-brand-600 hover:bg-brand-500 px-3 py-2 rounded-lg"
            >
              📍 {sucursalActiva === 'Todas' ? 'Ambas sucursales' : sucursalActiva} · Cambiar
            </button>
          )}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="px-4 py-3 text-sm text-left hover:bg-brand-600/60 border-t border-brand-600 hidden md:block"
        >
          🚪 Cerrar sesión
        </button>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}