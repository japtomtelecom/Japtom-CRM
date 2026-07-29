'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePerfil } from './usePerfil';

const CLAVE = 'sucursalActiva';

export function useSucursalActiva() {
  const { sucursalFija, loading } = usePerfil();
  const [activa, setActiva] = useState(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (sucursalFija) {
      setActiva(sucursalFija);
      setListo(true);
      return;
    }
    // Usuario "Todas": recuerda la elección de esta sesión, si ya eligió
    const guardada = typeof window !== 'undefined' ? sessionStorage.getItem(CLAVE) : null;
    setActiva(guardada || null);
    setListo(true);
  }, [loading, sucursalFija]);

  const elegir = useCallback((ciudad) => {
    if (typeof window !== 'undefined') sessionStorage.setItem(CLAVE, ciudad);
    setActiva(ciudad);
  }, []);

  const olvidar = useCallback(() => {
    if (typeof window !== 'undefined') sessionStorage.removeItem(CLAVE);
    setActiva(null);
  }, []);

  return {
    sucursalActiva: activa, // 'El Alto' | 'Tarija' | 'Todas' | null (aún sin elegir)
    esFija: !!sucursalFija,
    listo,
    elegir,
    olvidar,
  };
}
