// Devuelve los datos de conexión del MikroTik que corresponde a una ciudad,
// leyendo las variables de entorno del servidor (nunca expuestas al navegador).
export function configMikrotik(ciudad) {
  const prefijo = ciudad === 'Tarija' ? 'MIKROTIK_TARIJA' : 'MIKROTIK_ELALTO';

  const host = process.env[`${prefijo}_HOST`];
  const user = process.env[`${prefijo}_USER`];
  const password = process.env[`${prefijo}_PASSWORD`];
  const port = Number(process.env[`${prefijo}_PORT`] || 8728);

  if (!host || !user || !password) {
    throw new Error(
      `No hay un MikroTik configurado para "${ciudad}". Faltan las variables ${prefijo}_HOST / ${prefijo}_USER / ${prefijo}_PASSWORD en Vercel.`
    );
  }

  return { host, user, password, port };
}
