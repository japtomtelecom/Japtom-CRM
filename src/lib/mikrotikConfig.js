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

  if (!host || !user || !password) {
    throw new Error(
      `No hay un MikroTik configurado para "${ciudad}". Faltan las variables ${prefijo}_HOST / ${prefijo}_USER / ${prefijo}_PASSWORD en Vercel.`
    );
  }

  return { host, user, password, port, wanIface };
}
