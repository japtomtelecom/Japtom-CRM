import { Client } from 'ssh2';

// ============================================================
// Automatización por SSH de la OLT V-Sol (modelo V1600G0-B y similares).
//
// A diferencia del MikroTik (que tiene una API "de una sola vez" por
// puerto binario), esta OLT solo se gestiona con una terminal de consola
// interactiva (como si alguien entrara con PuTTY): hay que "navegar" el
// menú mandando un comando, esperando la respuesta, mandando el
// siguiente, etc.
//
// Estrategia usada aquí: en vez de tratar de adivinar el prompt exacto de
// cada modo (gpon-olt> / gpon-olt# / gpon-olt(config)# /
// gpon-olt(config-pon-0/x)#), se manda cada comando y se espera a que la
// OLT deje de mandar datos por un ratito corto ("se asienta") antes de
// mandar el siguiente. Es el mismo truco que usan las herramientas tipo
// "expect" para automatizar consolas de switches/routers.
// ============================================================

// Quita secuencias de escape ANSI (códigos de control de terminal, como
// "mover el cursor N columnas a la derecha" o colores). Esta OLT las usa
// para alinear columnas en algunas tablas (ej. "show onu state"): un
// programa de terminal como PuTTY las interpreta y muestra todo prolijo en
// una sola línea, pero si no se sacan del texto crudo, una palabra como
// "working" queda pegada al código de control (algo así como
// "[41Cworking") y ya no coincide con lo que buscan los parsers de abajo.
function limpiarAnsi(texto) {
  return texto.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export function ejecutarComandosOlt(config, comandos, opciones = {}) {
  const settleMs = opciones.settleMs ?? 700;
  const timeoutMs = opciones.timeoutMs ?? 20000;

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let salida = '';
    let indice = 0;
    let settleTimer = null;
    let terminado = false;

    const limiteGeneral = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      try { conn.end(); } catch {}
      reject(new Error('Tiempo de espera agotado conectando con la OLT.'));
    }, timeoutMs);

    function finalizar(fn, valor) {
      if (terminado) return;
      terminado = true;
      clearTimeout(limiteGeneral);
      if (settleTimer) clearTimeout(settleTimer);
      // Cierra la conexión SSH siempre, pase lo que pase (éxito, error o
      // timeout). Antes solo se cerraba el "shell" (con "exit"), pero no la
      // conexión SSH en sí — esta OLT solo permite una sesión SSH conectada
      // a la vez, y dejar conexiones a medio cerrar hacía que, después de
      // varias consultas seguidas, la OLT empezara a rechazar abrir nuevos
      // canales ("Channel open failure: open failed") aunque nadie tuviera
      // ninguna sesión abierta a mano (ni PuTTY ni nada).
      try { conn.end(); } catch {}
      fn(valor);
    }

    function enviarSiguiente(stream) {
      if (terminado) return;
      if (indice >= comandos.length) {
        stream.end('exit\n');
        return;
      }
      const cmd = comandos[indice++];
      stream.write(cmd + '\n');
    }

    conn.on('ready', () => {
      conn.shell({ term: 'vt100', cols: 200, rows: 50 }, (err, stream) => {
        if (err) return finalizar(reject, err);

        stream.on('data', (data) => {
          salida += limpiarAnsi(data.toString('utf8'));
          if (settleTimer) clearTimeout(settleTimer);
          settleTimer = setTimeout(() => enviarSiguiente(stream), settleMs);
        });
        stream.on('close', () => finalizar(resolve, salida));
        stream.on('error', (e) => finalizar(reject, e));

        // Espera a que se asiente el banner de bienvenida antes del primer comando.
        settleTimer = setTimeout(() => enviarSiguiente(stream), settleMs);
      });
    });

    conn.on('error', (err) => finalizar(reject, new Error('No se pudo conectar por SSH: ' + err.message)));

    // Muchos equipos de telecomunicaciones (esta OLT V-Sol incluida) solo
    // aceptan autenticación "keyboard-interactive" en vez de "password"
    // plano — es el mismo mecanismo que usa PuTTY cuando te muestra el
    // prompt "Password:" después de conectar. Si el cliente SSH no ofrece
    // este método, la conexión falla con "All configured authentication
    // methods failed" aunque el usuario y la contraseña sean correctos.
    // Acá respondemos cada "prompt" que pida la OLT con la misma contraseña.
    conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      finish(prompts.map(() => config.password));
    });

    conn.connect({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      tryKeyboard: true,
      readyTimeout: 10000,
    });
  });
}

// Arma la secuencia completa: entra a modo privilegiado, a configuración,
// y a la interfaz del puerto PON correcto, antes de los comandos que
// realmente importan (que se pasan en `comandosInternos`).
//
// Después de "enable" esta OLT pide una contraseña aparte para entrar al
// modo privilegiado (antes de "configure terminal") — sin esa línea, la
// OLT se queda esperando la contraseña y todos los comandos siguientes se
// interpretan mal, terminando en errores tipo "% Unknown command.".
export function comandosEnInterfazPon(puertoPon, comandosInternos, enablePassword) {
  return [
    'enable',
    ...(enablePassword ? [enablePassword] : []),
    'configure terminal',
    `interface gpon 0/${puertoPon}`,
    ...comandosInternos,
    'end',
  ];
}

// --- Parsers de la salida de texto de la OLT ---

// Ejemplo de salida real de "show onu <id> optical_info":
//   Rx optical level(ONU)      : -23.98
//   Tx optical level           : 2.02
//   Power feed voltage         : 3.28(V)
//   Laser bias current         : 12.000(mA)
//   Temperature                : 55.000(C)
export function parseOpticalInfo(texto) {
  const num = (regex) => {
    const m = texto.match(regex);
    return m ? Number(m[1]) : null;
  };
  return {
    rxDbm: num(/Rx optical level\(ONU\)\s*:\s*(-?[\d.]+)/i),
    txDbm: num(/Tx optical level\s*:\s*(-?[\d.]+)/i),
    voltajeV: num(/Power feed voltage\s*:\s*(-?[\d.]+)/i),
    corrienteLaserMa: num(/Laser bias current\s*:\s*(-?[\d.]+)/i),
    temperaturaC: num(/Temperature\s*:\s*(-?[\d.]+)/i),
  };
}

// Ejemplo de salida real de "show onu state <id>":
//   OnuIndex    Admin State    OMCC State    Phase State    Serial Number
//   GPON0/1:1   enable         enable        working        HWTC10ea4bab
export function parseOnuState(texto) {
  const m = texto.match(/GPON\d+\/\d+:\d+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
  if (!m) return { encontrado: false };
  return {
    encontrado: true,
    adminState: m[1],
    omccState: m[2],
    phaseState: m[3], // "working" = ONU en línea y funcionando bien
    serial: m[4],
    online: m[3] === 'working',
  };
}

// Umbrales orientativos de potencia óptica recibida EN LA OLT (dBm) —
// típicos para GPON. Ajusta estos números si tu instalador usa otro
// criterio; no vienen de una hoja de datos oficial de tu equipo puntual.
export function evaluarRx(rxDbm) {
  if (rxDbm === null || rxDbm === undefined) return 'desconocido';
  if (rxDbm >= -8) return 'alto'; // podría estar saturando el receptor
  if (rxDbm > -25) return 'bueno';
  if (rxDbm > -27) return 'marginal';
  return 'critico';
}

// Detecta mensajes de error típicos del CLI de la OLT (comando mal
// escrito, sintaxis incompleta, etc.) para no reportar éxito falso.
export function detectarErrorCli(texto) {
  const m = texto.match(/%\s*(Unknown command[^\n]*|Invalid[^\n]*|Incomplete command[^\n]*|There is no matched command[^\n]*)/i);
  return m ? m[0].trim() : null;
}
