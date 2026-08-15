// Devuelve los datos de conexión SSH de la OLT V-Sol que corresponde a una
// ciudad, leyendo las variables de entorno del servidor (nunca expuestas
// al navegador). Mismo patrón que mikrotikConfig.js.
export function configOlt(ciudad) {
  const prefijo = ciudad === 'Tarija' ? 'OLT_TARIJA' : 'OLT_ELALTO';

  const host = process.env[`${prefijo}_HOST`];
  const user = process.env[`${prefijo}_USER`];
  const password = process.env[`${prefijo}_PASSWORD`];
  const port = Number(process.env[`${prefijo}_PORT`] || 22);

  if (!host || !user || !password) {
    throw new Error(
      `No hay una OLT configurada para "${ciudad}". Faltan las variables ${prefijo}_HOST / ${prefijo}_USER / ${prefijo}_PASSWORD en Vercel.`
    );
  }

  return { host, user, password, port };
}
