// ============================================================
// Tráfico en tiempo real del MikroTik.
//
// Primer intento: se usó el comando "/interface/monitor-traffic" con la
// bandera "once" (que en teoría hace que RouterOS mande UNA sola lectura y
// termine). En la práctica, contra el router real, esa llamada se quedó
// esperando y terminó en "Timed out after 8 seconds" — probablemente
// RouterOS lo trató como un comando de "escucha continua" (como
// "/tool/torch") en vez de devolver el control enseguida.
//
// Se cambió a un método más simple y muy usado para armar dashboards de
// tráfico: leer el contador de bytes acumulados de la interfaz (rx-byte /
// tx-byte, con "/interface/print"), esperar un segundo, leerlo de nuevo, y
// calcular la velocidad nosotros mismos con la diferencia. Es el mismo
// principio que usa cualquier herramienta de monitoreo (RRDtool, LibreNMS,
// etc.) y solo depende de un comando de lectura común ("/interface/print"),
// del mismo tipo que ya usan sin problemas las otras rutas de este CRM
// (`/ppp/secret/print`, `/ppp/active/print`).
// ============================================================

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `conn` ya debe estar conectado (ver rutas de /api/mikrotik/*).
async function leerContadores(conn, interfaz) {
  const datos = await conn.write('/interface/print', [
    `?name=${interfaz}`,
    '=.proplist=rx-byte,tx-byte',
  ]);
  if (!datos.length) return null;
  return {
    rxByte: Number(datos[0]['rx-byte'] || 0),
    txByte: Number(datos[0]['tx-byte'] || 0),
  };
}

// Toma dos lecturas del contador de bytes con `muestraMs` de diferencia y
// devuelve la velocidad instantánea (bits por segundo) calculada con la
// diferencia entre ambas.
export async function leerTraficoConConexion(conn, interfaz, muestraMs = 1000) {
  const primera = await leerContadores(conn, interfaz);
  if (!primera) return null;

  const inicio = Date.now();
  await esperar(muestraMs);
  const segundos = (Date.now() - inicio) / 1000;

  const segunda = await leerContadores(conn, interfaz);
  if (!segunda) return null;

  if (segundos <= 0) return { rxBps: 0, txBps: 0 };

  return {
    // Si el router se reinició justo entre las dos lecturas, el contador
    // vuelve a cero y la resta daría negativa — se recorta a 0 en vez de
    // mostrar un número sin sentido.
    rxBps: Math.max(0, ((segunda.rxByte - primera.rxByte) * 8) / segundos),
    txBps: Math.max(0, ((segunda.txByte - primera.txByte) * 8) / segundos),
  };
}

// Cuando un cliente PPPoE está conectado, RouterOS crea una interfaz
// dinámica para esa sesión. Se probó primero con el nombre "<pppoe-usuario>"
// a secas, pero en este router real el nombre real viene con un sufijo
// extra (ej. "<pppoe-csb00001@ipdinamica>", visto en Winbox → PPP →
// Interface → "PPPoE Server Binding") — probablemente el nombre del
// perfil/servicio PPPoE configurado. En vez de adivinar ese sufijo, se
// busca entre TODAS las interfaces dinámicas (así se detectan también
// sesiones futuras que puedan estar con otro perfil) una cuyo nombre
// contenga el usuario.
export async function buscarInterfazPppoeConConexion(conn, usuario) {
  const candidato = `<pppoe-${usuario}>`;
  const encontrada = await conn.write('/interface/print', [`?name=${candidato}`]);
  if (encontrada.length) return candidato;

  const dinamicas = await conn.write('/interface/print', ['?dynamic=yes']);
  const match = dinamicas.find((i) => (i.name || '').includes(usuario));
  return match ? match.name : null;
}
