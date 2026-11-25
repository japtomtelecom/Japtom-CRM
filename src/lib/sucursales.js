// Lista central de sucursales y de qué equipos usa cada una.
// Para agregar una sucursal nueva, empieza por aquí.
export const SUCURSALES = ['El Alto', 'Tarija', 'Copacabana'];

// Prefijo de las variables de entorno (Vercel) del MikroTik de cada sede.
export function prefijoMikrotik(ciudad) {
  if (ciudad === 'Tarija') return 'MIKROTIK_TARIJA';
  if (ciudad === 'Copacabana') return 'MIKROTIK_COPACABANA';
  return 'MIKROTIK_ELALTO';
}

// Prefijo de las variables de entorno (Vercel) de la OLT V-Sol de cada sede.
export function prefijoOlt(ciudad) {
  if (ciudad === 'Tarija') return 'OLT_TARIJA';
  if (ciudad === 'Copacabana') return 'OLT_COPACABANA';
  return 'OLT_ELALTO';
}

// Sedes cuya OLT es V-Sol (se controla por SSH con oltSsh.js).
export function usaOltVsol(ciudad) {
  return ciudad === 'Tarija' || ciudad === 'Copacabana';
}
