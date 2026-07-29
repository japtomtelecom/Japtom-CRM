'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = cargando, null = sin sesión

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return {
    session,
    loading: session === undefined,
    user: session?.user ?? null,
  };
}
