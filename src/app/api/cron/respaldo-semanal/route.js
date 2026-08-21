import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { construirLibro, CIUDADES } from '@/lib/exportExcel';
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

    const [{ data: clientesTodos }, { data: pagosTodos }, { data: planes }, { data: registroTodo }] =
      await Promise.all([
        supabaseAdmin.from('v_clientes_estado').select('*').order('codigo', { ascending: true }),
        supabaseAdmin
          .from('pagos')
          .select('fecha_pago, monto, tipo_pago, mes_corresponde, clientes(codigo, nombre, ciudad)')
          .order('fecha_pago', { ascending: false }),
        supabaseAdmin.from('planes').select('*').order('precio', { ascending: true }),
        supabaseAdmin.from('v_registro_pagos_mensual').select('*'),
      ]);

    const datos = {
      clientesTodos: clientesTodos || [],
      pagosTodos: pagosTodos || [],
      planes: planes || [],
      registroTodo: registroTodo || [],
    };

    const resultados = [];
    for (const ciudad of CIUDADES) {
      const wb = construirLibro(ciudad, datos);
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
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
