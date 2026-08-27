import { createClient } from '@supabase/supabase-js';
import { RouterOSAPI } from 'node-routeros';
import { configMikrotik } from '@/lib/mikrotikConfig';

// Revisa periódicamente el estado PPPoE de TODOS los clientes activos (de
// las dos sedes) y actualiza `estado_pppoe`, para que el "desde hace cuánto
// está desconectado" que se ve en la ficha del cliente siga siendo preciso
// aunque nadie haya abierto esa ficha justo cuando se cortó la conexión.
//
// Nota sobre la frecuencia: el proyecto está en el plan gratuito ("Hobby")
// de Vercel, que limita los Cron Jobs a como mucho una vez al día — por eso
// vercel.json lo registra con "0 8 * * *" (una vez por día, 8:00 UTC = 4:00
// hora de Bolivia) en vez de cada pocos minutos. El botón "Ver estado de
// conexión" de la ficha (src/app/api/estado-conexion/route.js) NO depende
// de este cron para funcionar — hace su propia consulta en vivo cada vez
// que se usa, y de paso también actualiza `estado_pppoe`, así que el
// historial se va completando con el uso normal del CRM durante el día; este
// cron diario es solo un respaldo para los clientes que nadie revisó ese
// día. Si en el futuro se quiere una actualización más seguida sin pasar al
// plan Pro de Vercel, se puede llamar a esta misma URL desde un servicio
// externo gratuito (ej. cron-job.org o un GitHub Action programado cada
// pocos minutos) usando el mismo CRON_SECRET como token "Bearer" — no
// requiere tocar este código, solo configurar el disparador externo.
export const maxDuration = 60;

function clienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Revisa de una sola vez a todos los clientes de una ciudad: una sola
// conexión al MikroTik de esa sede, una sola lectura de "quién está
// conectado ahora mismo" (en vez de una conexión por cliente).
async function revisarCiudad(supabaseAdmin, ciudad, clientes) {
  const routerConfig = configMikrotik(ciudad);
  const conn = new RouterOSAPI({ ...routerConfig, timeout: 15 });
  await conn.connect();
  const activos = await conn.write('/ppp/active/print', ['=.proplist=name']);
  conn.close();

  const nombresActivos = new Set(activos.map((a) => a.name));

  const ahora = new Date().toISOString();
  const { data: previos } = await supabaseAdmin
    .from('estado_pppoe')
    .select('cliente_id, conectado, cambio_en')
    .in('cliente_id', clientes.map((c) => c.id));
  const previoPorId = new Map((previos || []).map((p) => [p.cliente_id, p]));

  const filas = clientes.map((c) => {
    const conectado = nombresActivos.has(c.pppoe_usuario);
    const previo = previoPorId.get(c.id);
    const cambioEn = previo && previo.conectado === conectado ? previo.cambio_en : ahora;
    return { cliente_id: c.id, conectado, cambio_en: cambioEn, revisado_en: ahora };
  });

  if (filas.length) {
    const { error } = await supabaseAdmin.from('estado_pppoe').upsert(filas);
    if (error) throw error;
  }
  return filas.length;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = clienteAdmin();

  const { data: clientes, error } = await supabaseAdmin
    .from('clientes')
    .select('id, ciudad, pppoe_usuario')
    .eq('activo', true)
    .not('pppoe_usuario', 'is', null);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const porCiudad = { Tarija: [], 'El Alto': [] };
  (clientes || []).forEach((c) => {
    const ciudad = c.ciudad === 'Tarija' ? 'Tarija' : 'El Alto';
    porCiudad[ciudad].push(c);
  });

  const resultados = {};
  for (const ciudad of Object.keys(porCiudad)) {
    if (!porCiudad[ciudad].length) {
      resultados[ciudad] = 0;
      continue;
    }
    try {
      resultados[ciudad] = await revisarCiudad(supabaseAdmin, ciudad, porCiudad[ciudad]);
    } catch (e) {
      resultados[ciudad] = { error: e.message };
    }
  }

  return Response.json({ ok: true, resultados });
}
