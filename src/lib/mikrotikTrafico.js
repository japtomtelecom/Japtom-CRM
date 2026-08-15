// ============================================================
// Tráfico en tiempo real del MikroTik.
//
// RouterOS calcula la velocidad instantánea de una interfaz internamente
// (es el mismo cálculo que usa el gráfico de tráfico de Winbox), así que no
// hace falta que nosotros tomemos dos lecturas y restemos: alcanza con
// pedir "/interface/monitor-traffic" con la bandera "once" — así el router
// contesta con UNA sola lectura y termina, en vez de dejar la conexión
// abierta mandando datos sin parar (que no encaja bien con funciones
// "serverless" de corta duración como las de Vercel).
// ============================================================

// `conn` ya debe estar conectado (ver rutas de /api/mikrotik/*).
export async function leerTraficoConConexion(conn, interfaz) {
  const datos = await conn.write('/interface/monitor-traffic', [
    `=interface=${interfaz}`,
    '=once=',
  ]);
  if (!datos.length) return null;
  return {
    rxBps: Number(datos[0]['rx-bits-per-second'] || 0),
    txBps: Number(datos[0]['tx-bits-per-second'] || 0),
  };
}

// Cuando un cliente PPPoE está conectado, RouterOS crea una interfaz
// dinámica para esa sesión, normalmente llamada "<pppoe-usuario>" (con los
// símbolos < > incluidos en el nombre). Se confirma contra el router real
// por si en esta versión/configuración de RouterOS el nombre sale distinto.
export async function buscarInterfazPppoeConConexion(conn, usuario) {
  const candidato = `<pppoe-${usuario}>`;
  const encontrada = await conn.write('/interface/print', [`?name=${candidato}`]);
  if (encontrada.length) return candidato;

  // Alternativa: entre las interfaces de tipo "pppoe-in", buscar una cuyo
  // nombre contenga el usuario.
  const todas = await conn.write('/interface/print', ['?type=pppoe-in']);
  const match = todas.find((i) => (i.name || '').includes(usuario));
  return match ? match.name : null;
}
