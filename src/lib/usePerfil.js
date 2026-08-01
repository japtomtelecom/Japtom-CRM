'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
export function usePerfil() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState(undefined); // undefined = cargando
  useEffect(() => {
    if (!user) {
      setPerfil(undefined);
      return;
    }
    supabase
      .from('perfiles')
      .select('rol, sucursal')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setPerfil(data || { rol: 'cobrador', sucursal: 'Todas' }));
  }, [user]);
  return {
    rol: perfil?.rol,
    sucursal: perfil?.sucursal,
    isAdmin: perfil?.rol === 'admin',
    isViewer: perfil?.rol === 'viewer',
    puedeGestionar: perfil?.rol !== 'viewer',
    sucursalFija: perfil && perfil.sucursal !== 'Todas' ? perfil.sucursal : null,
    loading: perfil === undefined,
  };
}