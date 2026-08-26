'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { usePerfil } from '@/lib/usePerfil';
import { exportarExcel } from '@/lib/exportExcel';

const CAMPOS = [
  { clave: 'empresa_nombre', label: 'Nombre de la empresa' },
  { clave: 'empresa_slogan', label: 'Eslogan' },
  { clave: 'whatsapp_contacto', label: 'WhatsApp de contacto' },
  { clave: 'banco_nombre', label: 'Banco (para QR de pago)' },
  { clave: 'banco_cuenta', label: 'Cuenta bancaria' },
  { clave: 'qr_imagen_url', label: 'URL de la imagen del QR de pago' },
  { clave: 'mensaje_recordatorio', label: 'Plantilla: recordatorio de pago (vencido)', textarea: true },
  { clave: 'mensaje_por_vencer', label: 'Plantilla: recordatorio de pago (por vencer, 1-2 días antes)', textarea: true },
  { clave: 'mensaje_al_dia', label: 'Plantilla: cliente al día', textarea: true },
  { clave: 'mensaje_inactivo', label: 'Plantilla: cliente inactivo', textarea: true },
  { clave: 'mensaje_corte', label: 'Plantilla: aviso de corte por falta de pago', textarea: true },
];

export default function ConfiguracionPage() {
  const { isAdmin } = usePerfil();
  const [valores, setValores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [exportando, setExportando] = useState(false);

  async function handleExportar() {
    setExportando(true);
    try {
      await exportarExcel();
    } finally {
      setExportando(false);
    }
  }

  useEffect(() => {
    supabase
      .from('config')
      .select('*')
      .then(({ data }) => {
        const v = {};
        (data || []).forEach((r) => (v[r.clave] = r.valor));
        setValores(v);
      });
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setMsg('');
    const upserts = CAMPOS.map((c) => ({ clave: c.clave, valor: valores[c.clave] || '' }));
    const { error } = await supabase.from('config').upsert(upserts);
    setGuardando(false);
    setMsg(error ? 'Error: ' + error.message : 'Configuración guardada.');
  }

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold text-brand-800 mb-6">Configuración</h1>

      <div className="card p-6 max-w-2xl mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-brand-700">Exportar a Excel</h2>
          <p className="text-sm text-brand-500">
            Descarga un .xlsx con Clientes, Pagos, Planes y Resumen — mismos datos que ves hoy en el CRM.
          </p>
        </div>
        <button onClick={handleExportar} disabled={exportando} className="btn-secondary whitespace-nowrap">
          {exportando ? 'Generando…' : '⬇️ Descargar Excel'}
        </button>
      </div>

      <form onSubmit={guardar} className="card p-6 max-w-2xl space-y-4">
        {!isAdmin && (
          <p className="text-brand-400 text-sm">
            Solo un administrador puede editar la configuración. Puedes ver los valores actuales abajo.
          </p>
        )}
        {CAMPOS.map((c) => (
          <div key={c.clave}>
            <label className="label">{c.label}</label>
            {c.textarea ? (
              <textarea
                className="input"
                rows={4}
                disabled={!isAdmin}
                value={valores[c.clave] || ''}
                onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
              />
            ) : (
              <input
                className="input"
                disabled={!isAdmin}
                value={valores[c.clave] || ''}
                onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
              />
            )}
          </div>
        ))}
        {valores.qr_imagen_url && (
          <img src={valores.qr_imagen_url} alt="QR de pago" className="w-40 rounded-lg border border-brand-100" />
        )}
        {msg && <p className="text-sm text-brand-600">{msg}</p>}
        {isAdmin && (
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
        )}
      </form>
      <p className="text-xs text-brand-400 max-w-2xl mt-3">
        Usa <code>{'{nombre}'}</code>, <code>{'{codigo}'}</code>, <code>{'{precio}'}</code>,{' '}
        <code>{'{dia_pago}'}</code>, <code>{'{empresa}'}</code> y <code>{'{plan}'}</code> en las plantillas — se
        reemplazan automáticamente por los datos de cada cliente.
      </p>
    </AppShell>
  );
}
