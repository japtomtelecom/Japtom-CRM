import { createClient } from '@supabase/supabase-js';
import { construirLibro, cargarLogo, CIUDADES } from '@/lib/exportExcel';
import { subirOActualizarArchivo } from '@/lib/googleDrive';
import { enviarCorreoRespaldoOk, enviarCorreoRespaldoError } from '@/lib/enviarCorreoRespaldo';

export const maxDuration = 60;

function clienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Nombre de archivo estable dentro del mes en curso: cada semana que corre
// este cron sobre el mismo mes, "subirOActualizarArchivo" encuentra el mismo
// nombre y actualiza su contenido en vez de crear uno nuevo (así es como se
// cumple "actualizando datos" + "un archivo mes a mes por ciudad").
function nombreArchivoDelMes(ciudad) {
  const ahora = new Date();
  const aaaa_mm = ahora.toISOString().slice(0, 7); // "2026-08"
  const sufijoCiudad = ciudad.replace(/\s+/g, '');
  return `Respaldo_JapTom_${sufijoCiudad}_${aaaa_mm}.xlsx`;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseAdmin = clienteAdmin();

    // Mismas consultas que el botón manual de Excel (src/lib/exportExcel.js),
    // para que el respaldo salga igual de completo (incluye "con_factura" de
    // los pagos y los trabajos adicionales).
    const [{ data: clientesTodos }, { data: pagosTodos }, { data: planes }, { data: registroTodo }, { data: trabajosTodos }] =
      await Promise.all([
        supabaseAdmin.from('v_clientes_estado').select('*').order('codigo', { ascending: true }),
        supabaseAdmin
          .from('pagos')
          .select('fecha_pago, monto, tipo_pago, mes_corresponde, con_factura, clientes(codigo, nombre, ciudad)')
          .order('fecha_pago', { ascending: false }),
        supabaseAdmin.from('planes').select('*').order('precio', { ascending: true }),
        supabaseAdmin.from('v_registro_pagos_mensual').select('*'),
        supabaseAdmin
          .from('trabajos_adicionales')
          .select('fecha, tipo, descripcion, monto, costo_materiales, ciudad, con_factura, nit, nombre_cliente_externo, clientes(codigo, nombre)')
          .order('fecha', { ascending: false }),
      ]);

    const datos = {
      clientesTodos: clientesTodos || [],
      pagosTodos: pagosTodos || [],
      planes: planes || [],
      registroTodo: registroTodo || [],
      trabajosTodos: trabajosTodos || [],
    };

    // Logo de la empresa (public/logo.png) tomado del mismo sitio que ejecuta
    // el cron; si no se puede descargar, el respaldo se genera sin logo.
    const logo = await cargarLogo(new URL(request.url).origin);

    const resultados = [];
    for (const ciudad of CIUDADES) {
      const wb = await construirLibro(ciudad, datos, { logo });
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const nombreArchivo = nombreArchivoDelMes(ciudad);
      const subida = await subirOActualizarArchivo(nombreArchivo, buffer);
      resultados.push({ ciudad, nombreArchivo, ...subida });
    }

    await enviarCorreoRespaldoOk(resultados);

    return Response.json({ ok: true, resultados });
  } catch (error) {
    await enviarCorreoRespaldoError(error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
