// Devuelve los datos de conexión del MikroTik que corresponde a una ciudad,
// leyendo las variables de entorno del servidor (nunca expuestas al navegador).
export function configMikrotik(ciudad) {
  const prefijo = ciudad === 'Tarija' ? 'MIKROTIK_TARIJA' : 'MIKROTIK_ELALTO';

  const host = process.env[`${prefijo}_HOST`];
  const user = process.env[`${prefijo}_USER`];
  const password = process.env[`${prefijo}_PASSWORD`];
  const port = Number(process.env[`${prefijo}_PORT`] || 8728);
  // Nombre de la interfaz "WAN" (la que lleva el tráfico de internet real)
  // para el panel de "Tráfico en tiempo real" del router completo. No hay
  // forma de adivinarlo solo (cada sede puede tener su propia VLAN/nombre),
  // así que se define a mano en Vercel. Si no está configurada, el panel de
  // tráfico general de esa sede simplemente no se muestra/avisa el motivo.
  const wanIface = process.env[`${prefijo}_WAN_IFACE`] || null;

  // Para sedes con más de una salida de internet (ej. El Alto, que tiene
  // COMTECO y ENTEL como proveedores separados), en vez de una sola
  // interfaz WAN se puede definir una lista de "Nombre:interfaz",
  // separadas por coma. Ej.:
  //   MIKROTIK_ELALTO_ENLACES=COMTECO:sfp-sfpplus1 COMTECO 1,ENTEL:sfp-sfpplus5. Entel Pampahasi
  // (los nombres de interfaz pueden tener espacios y puntos, tal cual
  // aparecen en Winbox — se parte solo por la primera "," de cada bloque
  // y los ":" para separar nombre de interfaz).
  const enlacesRaw = process.env[`${prefijo}_ENLACES`] || '';
  const enlaces = enlacesRaw
    .split(',')
    .map((par) => par.trim())
    .filter(Boolean)
    .map((par) => {
      const idx = par.indexOf(':');
      if (idx === -1) return null;
      const nombre = par.slice(0, idx).trim();
      const interfaz = par.slice(idx + 1).trim();
      return nombre && interfaz ? { nombre, interfaz } : null;
    })
    .filter(Boolean);

  if (!host || !user || !password) {
    throw new Error(
      `No hay un MikroTik configurado para "${ciudad}". Faltan las variables ${prefijo}_HOST / ${prefijo}_USER / ${prefijo}_PASSWORD en Vercel.`
    );
  }

  return { host, user, password, port, wanIface, enlaces };
}
