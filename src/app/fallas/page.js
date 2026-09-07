'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { generarBoletaFallaMasiva } from '@/lib/generarTicket';

// --- Helpers de fecha/hora ---------------------------------------------
// Convierte un ISO (o "ahora" si no se pasa nada) al formato que necesita
// un <input type="datetime-local"> (hora LOCAL del navegador, sin zona).
function isoADatetimeLocal(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Convierte el valor de un <input type="datetime-local"> (hora local) a ISO
// para guardar en Supabase. new Date("YYYY-MM-DDTHH:mm") ya se interpreta
// en hora local del navegador, así que no hace falta ajustar nada más.
function datetimeLocalAIso(valor) {
  if (!valor) return new Date().toISOString();
  return new Date(valor).toISOString();
}

function ModalFallaMasiva({ onConfirmar, onClose }) {
  const [ciudad, setCiudad] = useState('El Alto');
  const [sector, setSector] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaApertura, setFechaApertura] = useState(isoADatetimeLocal());
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (!sector.trim() || !descripcion.trim()) return;
    setGuardando(true);
    await onConfirmar({
      ciudad,
      sector: sector.trim(),
      descripcion: descripcion.trim(),
      fechaApertura: datetimeLocalAIso(fechaApertura),
    });
    setGuardando(false);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={guardando ? undefined : onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 400, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>🆘 Reportar falla masiva</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: -8 }}>
          Para un corte o problema que afecta a una zona entera (no a un cliente puntual).
        </p>

        <label className="label" style={{ marginTop: 12 }}>Ciudad</label>
        <select className="input" value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
          <option value="El Alto">El Alto</option>
          <option value="Tarija">Tarija</option>
        </select>

        <label className="label" style={{ marginTop: 12 }}>Sector afectado</label>
        <input
          className="input"
          placeholder="Ej. Zona Ballivián, Urb. Copacabana…"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        />

        <label className="label" style={{ marginTop: 12 }}>Fecha y hora de apertura</label>
        <input
          type="datetime-local"
          className="input"
          value={fechaApertura}
          onChange={(e) => setFechaApertura(e.target.value)}
        />

        <label className="label" style={{ marginTop: 12 }}>Descripción</label>
        <textarea
          className="input"
          rows={3}
          placeholder="¿Qué pasó?"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />

        <div className="flex gap-2 mt-4">
          <button onClick={confirmar} disabled={guardando || !sector.trim() || !descripcion.trim()} className="btn-primary">
            {guardando ? 'Guardando…' : 'Reportar falla'}
          </button>
          <button onClick={onClose} disabled={guardando} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCerrarFalla({ ticket, onConfirmar, onClose }) {
  const [resolucion, setResolucion] = useState('');
  const [fechaCierre, setFechaCierre] = useState(isoADatetimeLocal());
  const [guardando, setGuardando] = useState(false);
  const esMasiva = ticket.tipo === 'masiva';

  async function confirmar() {
    setGuardando(true);
    await onConfirmar({
      resolucion,
      fechaCierre: esMasiva ? datetimeLocalAIso(fechaCierre) : new Date().toISOString(),
    });
    setGuardando(false);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={guardando ? undefined : onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Cerrar falla</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: -8 }}>{ticket.descripcion}</p>

        {esMasiva && (
          <>
            <label className="label" style={{ marginTop: 12 }}>Fecha y hora de cierre</label>
            <input
              type="datetime-local"
              className="input"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
            />
          </>
        )}

        <label className="label" style={{ marginTop: 12 }}>Resolución (opcional)</label>
        <textarea
          className="input"
          rows={3}
          placeholder="¿Cómo se resolvió?"
          value={resolucion}
          onChange={(e) => setResolucion(e.target.value)}
        />

        <div className="flex gap-2 mt-4">
          <button onClick={confirmar} disabled={guardando} className="btn-primary">
            {guardando ? 'Cerrando…' : 'Cerrar falla'}
          </button>
          <button onClick={onClose} disabled={guardando} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// Editar las fechas de una falla masiva YA CARGADA (para corregir errores
// de carga) — separado del flujo de "Reportar"/"Cerrar", que ya piden la
// fecha en su momento. Solo aplica a fallas masivas.
function ModalEditarFechasMasiva({ ticket, onGuardar, onClose }) {
  const [fechaApertura, setFechaApertura] = useState(isoADatetimeLocal(ticket.creado_en));
  const [fechaCierre, setFechaCierre] = useState(isoADatetimeLocal(ticket.cerrado_en));
  const [guardando, setGuardando] = useState(false);
  const estaCerrada = ticket.estado === 'cerrado';

  async function guardar() {
    setGuardando(true);
    await onGuardar({
      fechaApertura: datetimeLocalAIso(fechaApertura),
      fechaCierre: estaCerrada ? datetimeLocalAIso(fechaCierre) : null,
    });
    setGuardando(false);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={guardando ? undefined : onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>✏️ Editar fechas</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: -8 }}>
          {ticket.sector} ({ticket.ciudad})
        </p>

        <label className="label" style={{ marginTop: 12 }}>Fecha y hora de apertura</label>
        <input
          type="datetime-local"
          className="input"
          value={fechaApertura}
          onChange={(e) => setFechaApertura(e.target.value)}
        />

        {estaCerrada ? (
          <>
            <label className="label" style={{ marginTop: 12 }}>Fecha y hora de cierre</label>
            <input
              type="datetime-local"
              className="input"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
            />
          </>
        ) : (
          <p className="text-xs text-brand-400 mt-3">
            Esta falla sigue abierta, así que no tiene fecha de cierre todavía.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={guardar} disabled={guardando} className="btn-primary">
            {guardando ? 'Guardando…' : 'Guardar fechas'}
          </button>
          <button onClick={onClose} disabled={guardando} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FallasPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ciudadFiltro, setCiudadFiltro] = useState('todas');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [mostrarMasiva, setMostrarMasiva] = useState(false);
  const [ticketACerrar, setTicketACerrar] = useState(null);
  const [ticketAEditarFechas, setTicketAEditarFechas] = useState(null);
  const [empresaNombre, setEmpresaNombre] = useState('JapTom Telecom');

  async function cargar() {
    setCargando(true);
    setError('');
    const { data, error: err } = await supabase
      .from('tickets_falla')
      .select('*, clientes(codigo, nombre)')
      .order('creado_en', { ascending: false });
    if (err) setError('No se pudo cargar el historial de fallas: ' + err.message);
    setTickets(data || []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    supabase
      .from('config')
      .select('valor')
      .eq('clave', 'empresa_nombre')
      .single()
      .then(({ data }) => {
        if (data?.valor) setEmpresaNombre(data.valor);
      });
  }, []);

  async function reportarMasiva({ ciudad, sector, descripcion, fechaApertura }) {
    setError('');
    const { error: err } = await supabase.from('tickets_falla').insert({
      tipo: 'masiva',
      ciudad,
      sector,
      descripcion,
      creado_por: user?.email || null,
      creado_en: fechaApertura,
    });
    if (err) {
      setError('Error al reportar la falla masiva: ' + err.message);
      setMostrarMasiva(false);
      return;
    }
    setMostrarMasiva(false);
    cargar();
  }

  async function cerrarTicket({ resolucion, fechaCierre }) {
    setError('');
    const { error: err } = await supabase
      .from('tickets_falla')
      .update({
        estado: 'cerrado',
        cerrado_por: user?.email || null,
        cerrado_en: fechaCierre || new Date().toISOString(),
        resolucion: resolucion?.trim() || null,
      })
      .eq('id', ticketACerrar.id);
    if (err) {
      setError('Error al cerrar la falla: ' + err.message);
      setTicketACerrar(null);
      return;
    }
    setTicketACerrar(null);
    cargar();
  }

  async function guardarFechasMasiva({ fechaApertura, fechaCierre }) {
    setError('');
    const cambios = { creado_en: fechaApertura };
    if (fechaCierre) cambios.cerrado_en = fechaCierre;
    const { error: err } = await supabase.from('tickets_falla').update(cambios).eq('id', ticketAEditarFechas.id);
    if (err) {
      setError('Error al editar las fechas: ' + err.message);
      setTicketAEditarFechas(null);
      return;
    }
    setTicketAEditarFechas(null);
    cargar();
  }

  function descargarBoleta(ticket) {
    generarBoletaFallaMasiva(ticket, empresaNombre);
  }

  const filtrados = useMemo(() => {
    const busqueda = clienteFiltro.trim().toLowerCase();
    return tickets.filter((t) => {
      if (ciudadFiltro !== 'todas' && t.ciudad !== ciudadFiltro) return false;
      if (estadoFiltro !== 'todos' && t.estado !== estadoFiltro) return false;
      if (tipoFiltro !== 'todos' && t.tipo !== tipoFiltro) return false;
      if (busqueda) {
        const nombre = (t.clientes?.nombre || '').toLowerCase();
        const codigo = (t.clientes?.codigo || '').toLowerCase();
        const sector = (t.sector || '').toLowerCase();
        if (!nombre.includes(busqueda) && !codigo.includes(busqueda) && !sector.includes(busqueda)) return false;
      }
      return true;
    });
  }, [tickets, ciudadFiltro, estadoFiltro, tipoFiltro, clienteFiltro]);

  const abiertos = tickets.filter((t) => t.estado === 'abierto').length;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-800">🛠️ Fallas</h1>
          <p className="text-brand-500 text-sm mt-1">
            {abiertos > 0 ? `${abiertos} falla(s) abierta(s)` : 'Sin fallas abiertas'}
          </p>
        </div>
        <button onClick={() => setMostrarMasiva(true)} className="btn-primary">
          🆘 Reportar falla masiva
        </button>
      </div>

      <div className="card p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="label">Ciudad</label>
          <select className="input" value={ciudadFiltro} onChange={(e) => setCiudadFiltro(e.target.value)}>
            <option value="todas">Todas las ciudades</option>
            <option value="El Alto">El Alto</option>
            <option value="Tarija">Tarija</option>
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="abierto">Abierto</option>
            <option value="cerrado">Cerrado</option>
          </select>
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="individual">Cliente puntual</option>
            <option value="masiva">Falla masiva (zona)</option>
          </select>
        </div>
        <div>
          <label className="label">Cliente</label>
          <input
            className="input"
            placeholder="Buscar por nombre, código o sector…"
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#791F1F' }}>{error}</p>}

      {cargando ? (
        <p className="text-brand-500">Cargando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-brand-500">No hay fallas para estos filtros.</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((t) => (
            <div key={t.id} className="card p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  {t.tipo === 'masiva' ? (
                    <p className="font-semibold text-brand-700">
                      🆘 Falla masiva · {t.sector} ({t.ciudad})
                    </p>
                  ) : t.clientes ? (
                    <p className="font-semibold text-brand-700">
                      <Link href={`/clientes/${t.clientes.codigo}`} className="hover:underline">
                        {t.clientes.nombre} ({t.clientes.codigo})
                      </Link>{' '}
                      · {t.ciudad}
                    </p>
                  ) : (
                    <p className="font-semibold text-brand-700">Cliente eliminado · {t.ciudad}</p>
                  )}
                  <p className="text-xs text-brand-400 mt-1">
                    Apertura: {new Date(t.creado_en).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                    {t.creado_por ? ' · ' + t.creado_por : ''}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-1 rounded"
                  style={{
                    color: t.estado === 'cerrado' ? '#085041' : '#8a6d00',
                    background: t.estado === 'cerrado' ? '#E1F5EE' : '#FCF3D9',
                  }}
                >
                  {t.estado === 'cerrado' ? '✅ Cerrado' : '🟠 Abierto'}
                </span>
              </div>

              <p className="text-sm mt-2" style={{ whiteSpace: 'pre-wrap' }}>{t.descripcion}</p>

              {t.estado === 'cerrado' && (
                <p className="text-xs text-brand-400 mt-2">
                  Cierre: {new Date(t.cerrado_en).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                  {t.cerrado_por ? ' · ' + t.cerrado_por : ''}
                  {t.resolucion ? ' · ' + t.resolucion : ''}
                </p>
              )}

              <div className="flex gap-2 flex-wrap mt-3">
                {t.estado === 'abierto' && (
                  <button onClick={() => setTicketACerrar(t)} className="btn-secondary text-xs">
                    Cerrar falla
                  </button>
                )}
                {t.tipo === 'masiva' && (
                  <>
                    <button onClick={() => setTicketAEditarFechas(t)} className="btn-secondary text-xs">
                      ✏️ Editar fechas
                    </button>
                    <button onClick={() => descargarBoleta(t)} className="btn-secondary text-xs">
                      📄 Boleta PDF
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarMasiva && (
        <ModalFallaMasiva onConfirmar={reportarMasiva} onClose={() => setMostrarMasiva(false)} />
      )}
      {ticketACerrar && (
        <ModalCerrarFalla ticket={ticketACerrar} onConfirmar={cerrarTicket} onClose={() => setTicketACerrar(null)} />
      )}
      {ticketAEditarFechas && (
        <ModalEditarFechasMasiva
          ticket={ticketAEditarFechas}
          onGuardar={guardarFechasMasiva}
          onClose={() => setTicketAEditarFechas(null)}
        />
      )}
    </AppShell>
  );
}