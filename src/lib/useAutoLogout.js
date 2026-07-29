'use client';

import { useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

// Cierra la sesión automáticamente si no hay actividad (toques, clics,
// teclas, scroll) durante `minutos`. Pensado como capa extra de seguridad
// por si el celular o la computadora se pierden o se los roban con la
// sesión abierta.
export function useAutoLogout(minutos = 20) {
  const timerRef = useRef(null);

  useEffect(() => {
    function reiniciarTemporizador() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        supabase.auth.signOut();
      }, minutos * 60 * 1000);
    }

    const eventos = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    eventos.forEach((ev) => window.addEventListener(ev, reiniciarTemporizador));
    reiniciarTemporizador();

    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, reiniciarTemporizador));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [minutos]);
}
