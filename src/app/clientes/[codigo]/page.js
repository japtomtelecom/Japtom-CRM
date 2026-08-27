'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import GraficoTrafico from '@/components/GraficoTrafico';
import { supabase } from '@/lib/supabaseClient';
import { llamarApiAdmin } from '@/lib/llamarApiAdmin';
import { usePerfil } from '@/lib/usePerfil';
import { useAuth } from '@/lib/useAuth';
import { formatBs, linkWhatsApp, construirMensaje } from '@/lib/utils';
import { generarContrato } from '@/lib/generarContrato';
import { generarBoletaInstalacion } from '@/lib/generarBoleta';

function ModalBoleta({ cliente, empresaNombre, onClose }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState('Puerto óptico en NAP: ');
  const [generando, setGenerando] = useState(false);

  async function generar() {
    setGenerando(true);
    await generarBoletaInstalacion(cliente, fecha, observaciones, empresaNombre);
    setGenerando(false);
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Boleta de instalación</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: -8 }}>{cliente.nombre} · {cliente.codigo}</p>

        <label className="label" style={{ marginTop: 12 }}>Fecha</label>
        <input
          type="date"
          className="input"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <p style={{ fontSize: 12, color: '#888', marginTop: 12 }}>
          Los materiales (Fibra drop, ONT, Tensores plásticos, etc.) salen en la boleta con un espacio en blanco para que el técnico anote la cantidad a mano.
        </p>

        <label className="label" style={{ marginTop: 12 }}>Observaciones</label>
        <textarea
          className="input"
          rows={3}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />

        <div className="flex gap-2 mt-4">
          <button onClick={generar} disabled={generando} className="btn-primary">
            {generando ? 'Generando…' : 'Generar PDF'}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalContrato({ cliente, empresaNombre, onClose }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [generando, setGenerando] = useState(false);

  async function generar() {
    setGenerando(true);
    await generarContrato(cliente, empresaNombre, fecha);
    setGenerando(false);
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Generar contrato</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: -8 }}>{cliente.nombre} · {cliente.codigo}</p>

        <label className="label" style={{ marginTop: 12 }}>Fecha de firma</label>
        <input
          type="date"
          className="input"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <div className="flex gap-2 mt-4">
          <button onClick={generar} disabled={generando} className="btn-primary">
            {generando ? 'Generando…' : 'Generar PDF'}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalBorrarCliente({ cliente, onConfirmar, onClose }) {
  const [borrando, setBorrando] = useState(false);

  async function confirmar() {
    setBorrando(true);
    await onConfirmar();
    setBorrando(false);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={borrando ? undefined : onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 400, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: '#791F1F' }}>¿Desea borrar la ficha?</h3>
        <p style={{ fontSize: 14, marginTop: -4 }}>
          Se borrará definitivamente a <strong>{cliente.nombre}</strong> ({cliente.codigo}) y todo lo asociado:
          historial de pagos, apuntes, configuración de PPPoE (MikroTik) y configuración de OLT
          (puerto, ONU, SN).
        </p>
        <p style={{ fontSize: 13, color: '#791F1F', fontWeight: 500 }}>
          Esta acción no se puede deshacer.
        </p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={confirmar}
            disabled={borrando}
            className="btn-primary"
            style={{ background: '#791F1F' }}
          >
            {borrando ? 'Borrando…' : 'Sí, borrar'}
          </button>
          <button onClick={onClose} disabled={borrando} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelApuntes({ clienteId, userEmail }) {
  const [notas, setNotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [textoEditado, setTextoEditado] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState('');

  async function cargarNotas() {
    setCargando(true);
    const { data, error: err } = await supabase
      .from('notas_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('creado_en', { ascending: false });
    if (err) setError('No se pudieron cargar los apuntes: ' + err.message);
    setNotas(data || []);
    setCargando(false);
  }

  useEffect(() => {
    if (clienteId) cargarNotas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  async function agregar() {
    if (!nuevoTexto.trim()) return;
    setGuardando(true);
    setError('');
    const { error: err } = await supabase
      .from('notas_cliente')
      .insert({ cliente_id: clienteId, texto: nuevoTexto.trim(), creado_por: userEmail || null });
    setGuardando(false);
    if (err) {
      setError('Error al guardar el apunte: ' + err.message);
      return;
    }
    setNuevoTexto('');
    cargarNotas();
  }

  function iniciarEdicion(nota) {
    setEditandoId(nota.id);
    setTextoEditado(nota.texto);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setTextoEditado('');
  }

  async function guardarEdicion(id) {
    if (!textoEditado.trim()) return;
    setGuardandoEdicion(true);
    setError('');
    const { error: err } = await supabase
      .from('notas_cliente')
      .update({ texto: textoEditado.trim(), editado_en: new Date().toISOString() })
      .eq('id', id);
    setGuardandoEdicion(false);
    if (err) {
      setError('Error al editar el apunte: ' + err.message);
      return;
    }
    setEditandoId(null);
    setTextoEditado('');
    cargarNotas();
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este apunte? No se puede deshacer.')) return;
    setEliminandoId(id);
    setError('');
    const { error: err } = await supabase.from('notas_cliente').delete().eq('id', id);
    setEliminandoId(null);
    if (err) {
      setError('Error al eliminar el apunte: ' + err.message);
      return;
    }
    cargarNotas();
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-brand-700 mb-3">📝 Apuntes del cliente</h2>
      <p className="text-xs text-brand-400 mb-3">
        Notas internas del equipo — revísalas antes de escribirle al cliente (ej. por WhatsApp).
      </p>

      <div className="flex gap-2 mb-4">
        <textarea
          className="input flex-1"
          rows={2}
          placeholder="Agregar un apunte nuevo…"
          value={nuevoTexto}
          onChange={(e) => setNuevoTexto(e.target.value)}
        />
        <button onClick={agregar} disabled={guardando || !nuevoTexto.trim()} className="btn-primary" style={{ whiteSpace: 'nowrap', height: 'fit-content' }}>
          {guardando ? 'Guardando…' : 'Agregar'}
        </button>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#791F1F' }}>{error}</p>}

      {cargando ? (
        <p className="text-sm text-brand-400">Cargando apuntes…</p>
      ) : notas.length === 0 ? (
        <p className="text-sm text-brand-400">Sin apuntes registrados todavía.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {notas.map((n) => (
            <li key={n.id} className="border-b border-brand-50 pb-3">
              {editandoId === n.id ? (
                <div>
                  <textarea
                    className="input"
                    rows={2}
                    value={textoEditado}
                    onChange={(e) => setTextoEditado(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => guardarEdicion(n.id)} disabled={guardandoEdicion || !textoEditado.trim()} className="btn-primary text-xs">
                      {guardandoEdicion ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button onClick={cancelarEdicion} className="btn-secondary text-xs">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{n.texto}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-brand-400">
                      {new Date(n.creado_en).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                      {n.creado_por ? ' · ' + n.creado_por : ''}
                      {n.editado_en ? ' · editado' : ''}
                    </span>
                    <span className="flex gap-2">
                      <button onClick={() => iniciarEdicion(n)} className="text-brand-500 text-xs hover:underline">
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(n.id)}
                        disabled={eliminandoId === n.id}
                        className="text-xs hover:underline"
                        style={{ color: '#791F1F' }}
                      >
                        {eliminandoId === n.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </span>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PanelMikrotik({ cliente, onRecargar }) {
  const [accionEnCurso, setAccionEnCurso] = useState(null);
  const [resultado, setResultado] = useState(null);

  async function ejecutar(accion, endpoint, activar, confirmacion) {
    if (confirmacion && !confirm(confirmacion)) return;
    setAccionEnCurso(accion);
    setResultado(null);
    try {
      const body = endpoint === 'toggle' ? { clienteId: cliente.id, activar } : { clienteId: cliente.id };
      const json = await llamarApiAdmin(`/api/mikrotik/${endpoint}`, body);
      setResultado({ ok: true, mensaje: json.mensaje });
    } catch (e) {
      setResultado({ ok: false, error: e.message });
    } finally {
      setAccionEnCurso(null);
    }
  }

  function aceptarResultado() {
    setResultado(null);
    onRecargar?.(true);
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-brand-700 mb-3">Control MikroTik</h2>

      {!cliente.pppoe_usuario && (
        <p className="text-xs text-amber-600 mb-3">
          Este cliente no tiene "Usuario PPPoE" configurado. Completalo en "Editar" antes de usar estas acciones.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => ejecutar('crear', 'crear-usuario', undefined, `¿Confirmas crear el usuario PPPoE en MikroTik para ${cliente.nombre}?`)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
        >
          {accionEnCurso === 'crear' ? 'Creando…' : '➕ Crear usuario'}
        </button>
        <button
          onClick={() => ejecutar('plan', 'cambiar-plan', undefined, `¿Confirmas sincronizar el plan de ${cliente.nombre} en MikroTik?`)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
        >
          {accionEnCurso === 'plan' ? 'Aplicando…' : '🔄 Sincronizar plan'}
        </button>
        <button
          onClick={() => ejecutar('bloquear', 'toggle', false, `¿Confirmas BLOQUEAR el servicio de ${cliente.nombre}? Se cortará su acceso a Internet.`)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
          style={{ color: '#791F1F' }}
        >
          {accionEnCurso === 'bloquear' ? 'Bloqueando…' : '🔒 Bloquear servicio'}
        </button>
        <button
          onClick={() => ejecutar('reactivar', 'toggle', true, `¿Confirmas reactivar el servicio de ${cliente.nombre}?`)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
          style={{ color: '#085041' }}
        >
          {accionEnCurso === 'reactivar' ? 'Reactivando…' : '🔓 Reactivar servicio'}
        </button>
        <button
          onClick={() => ejecutar('cerrar', 'cerrar-sesion', undefined, `¿Confirmas cerrar la sesión activa de ${cliente.nombre}? Esto forzará un reinicio de su conexión.`)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm col-span-2"
        >
          {accionEnCurso === 'cerrar' ? 'Cerrando…' : '⏏️ Cerrar sesión activa (forzar reinicio)'}
        </button>
        <button
          onClick={() =>
            ejecutar(
              'borrar',
              'borrar-usuario',
              undefined,
              `¿Confirmas BORRAR el usuario PPPoE "${cliente.pppoe_usuario}" de ${cliente.nombre} del MikroTik? Esto corta su servicio de inmediato. No se puede deshacer (aunque podés volver a crearlo después con "Crear usuario"). Esto NO borra la ficha del cliente en el CRM.`
            )
          }
          disabled={accionEnCurso !== null || !cliente.pppoe_usuario}
          className="btn-secondary text-sm col-span-2"
          style={{ color: '#791F1F' }}
        >
          {accionEnCurso === 'borrar' ? 'Borrando…' : '🗑️ Borrar usuario del MikroTik'}
        </button>
      </div>
{resultado && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            background: resultado.ok ? '#E1F5EE' : '#FCEBEB',
            color: resultado.ok ? '#085041' : '#791F1F',
          }}
        >
          <p style={{ margin: 0 }}>
            {resultado.ok ? '✅ ' : '⚠️ '}
            {resultado.ok ? resultado.mensaje : resultado.error}
          </p>
          <button onClick={aceptarResultado} className="btn-primary text-xs" style={{ marginTop: 8 }}>
            Aceptar
          </button>
        </div>
      )}

    </div>
  );
}

const COLOR_NIVEL_OLT = {
  bueno: '#085041',
  marginal: '#8a6d00',
  critico: '#791F1F',
  alto: '#8a6d00',
  desconocido: '#666',
};

// Enlace para abrir la interfaz web del equipo del cliente en esa IP
// (https://<ip>:80/). Es su propio componente porque se usa en dos lugares
// (Configuración MikroTik y el resultado de "Estado de conexión") y así
// queda igual de grande y clicable en los dos.
function EnlaceIp({ ip }) {
  if (!ip) return '—';
  return (
    <a
      href={`https://${ip}:80/`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 hover:underline"
      style={{
        fontSize: 15,
        fontWeight: 600,
        padding: '5px 12px',
        borderRadius: 6,
        background: '#E1F5EE',
        color: '#085041',
      }}
      title="Abrir la interfaz web del equipo en esa IP"
    >
      🌐 {ip}
    </a>
  );
}

function PanelOlt({ cliente, onRecargar, optico, setOptico }) {
  const [accionEnCurso, setAccionEnCurso] = useState(null);
  const [resultado, setResultado] = useState(null);

  async function llamar(endpoint, body) {
    return llamarApiAdmin(`/api/olt/${endpoint}`, body);
  }

  async function verPotencia() {
    if (!confirm(`¿Confirmas consultar la potencia óptica de ${cliente.nombre} en la OLT?`)) return;
    setAccionEnCurso('potencia');
    setResultado(null);
    setOptico(null);
    try {
      const json = await llamar('optical', { clienteId: cliente.id });
      setOptico(json);
    } catch (e) {
      setResultado({ ok: false, error: e.message });
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function reiniciar() {
    if (!confirm(`¿Confirmas reiniciar el ONT de ${cliente.nombre}? La conexión se cortará unos segundos.`)) return;
    setAccionEnCurso('reiniciar');
    setResultado(null);
    try {
      const json = await llamar('reboot', { clienteId: cliente.id });
      setResultado({ ok: true, mensaje: json.mensaje });
    } catch (e) {
      setResultado({ ok: false, error: e.message });
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function toggle(activar) {
    const confirmacion = activar
      ? `¿Confirmas ACTIVAR la ONU de ${cliente.nombre}?`
      : `¿Confirmas DESACTIVAR la ONU de ${cliente.nombre}? Se cortará su acceso a Internet.`;
    if (!confirm(confirmacion)) return;
    setAccionEnCurso(activar ? 'reactivar' : 'bloquear');
    setResultado(null);
    try {
      const json = await llamar('toggle', { clienteId: cliente.id, activar });
      setResultado({ ok: true, mensaje: json.mensaje });
    } catch (e) {
      setResultado({ ok: false, error: e.message });
    } finally {
      setAccionEnCurso(null);
    }
  }

  function aceptarResultado() {
    setResultado(null);
    onRecargar?.(true);
  }

  function aceptarOptico() {
    setOptico(null);
    onRecargar?.(true);
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-brand-700 mb-3">Control OLT (V-Sol)</h2>

      {(!cliente.olt_puerto_pon || !cliente.olt_onu_id) && (
        <p className="text-xs text-amber-600 mb-3">
          Este cliente no tiene "Puerto PON" e "ID de ONU" configurados. Completalos en "Editar" antes de usar estas acciones.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={verPotencia}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm col-span-2"
        >
          {accionEnCurso === 'potencia' ? 'Consultando…' : '📶 Ver potencia óptica'}
        </button>
        <button
          onClick={() => toggle(false)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
          style={{ color: '#791F1F' }}
        >
          {accionEnCurso === 'bloquear' ? 'Desactivando…' : '🔒 Desactivar ONU'}
        </button>
        <button
          onClick={() => toggle(true)}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm"
          style={{ color: '#085041' }}
        >
          {accionEnCurso === 'reactivar' ? 'Activando…' : '🔓 Activar ONU'}
        </button>
        <button
          onClick={reiniciar}
          disabled={accionEnCurso !== null}
          className="btn-secondary text-sm col-span-2"
        >
          {accionEnCurso === 'reiniciar' ? 'Reiniciando…' : '🔁 Reiniciar ONT'}
        </button>
      </div>

      {optico && (
        <div className="mt-3">
          <p className="text-xs text-brand-400">
            👆 Resultado mostrado arriba, en "Potencia óptica".
          </p>
          <button onClick={aceptarOptico} className="btn-primary text-xs mt-2">
            Aceptar
          </button>
        </div>
      )}

      {resultado && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            background: resultado.ok ? '#E1F5EE' : '#FCEBEB',
            color: resultado.ok ? '#085041' : '#791F1F',
          }}
        >
          <p style={{ margin: 0 }}>
            {resultado.ok ? '✅ ' : '⚠️ '}
            {resultado.ok ? resultado.mensaje : resultado.error}
          </p>
          <button onClick={aceptarResultado} className="btn-primary text-xs" style={{ marginTop: 8 }}>
            Aceptar
          </button>
        </div>
      )}
    </div>
  );
}

// Convierte una fecha ISO a un texto corto tipo "3h 12min" / "2d 4h", para
// mostrar "desde hace cuánto" está desconectado un cliente.
function formatearDuracion(desdeIso) {
  if (!desdeIso) return null;
  const ms = Date.now() - new Date(desdeIso).getTime();
  if (ms < 60000) return 'menos de 1 min';

  const minutos = Math.floor(ms / 60000);
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const minRestantes = minutos % 60;
  if (horas < 24) return `${horas}h ${minRestantes}min`;

  const dias = Math.floor(horas / 24);
  const horasRestantes = horas % 24;
  return `${dias}d ${horasRestantes}h`;
}

// Botón de "Estado de conexión": consulta en vivo si el cliente está
// conectado por PPPoE (MikroTik, las dos sedes) y, en Tarija, además el
// estado de su ONU en la OLT (V-Sol) — en El Alto esa OLT todavía no está
// integrada al CRM (ver claude/estado-integracion-olt.md en el proyecto),
// así que ahí solo se muestra el PPPoE. Si el PPPoE está desconectado,
// muestra desde hace cuánto (usando el historial de `estado_pppoe`).
function PanelEstadoConexion({ cliente }) {
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);

  const esTarija = (cliente.ciudad || 'El Alto') === 'Tarija';

  async function consultar() {
    if (!confirm(`¿Confirmas consultar el estado de conexión de ${cliente.nombre}?`)) return;
    setCargando(true);
    setError(null);
    setEstado(null);
    try {
      const json = await llamarApiAdmin('/api/estado-conexion', { clienteId: cliente.id });
      setEstado(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  function aceptar() {
    setEstado(null);
    setError(null);
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-brand-700 mb-3">🔌 Estado de conexión</h2>

      {!cliente.pppoe_usuario ? (
        <p className="text-xs text-amber-600 mb-3">
          Este cliente no tiene "Usuario PPPoE" configurado. Completalo en "Editar" antes de usar esta función.
        </p>
      ) : !esTarija ? (
        <p className="text-xs text-brand-400 mb-3">
          En El Alto solo se muestra el estado del PPPoE — la OLT de esta sede todavía no está integrada al CRM.
        </p>
      ) : null}

      <button
        onClick={consultar}
        disabled={cargando || !cliente.pppoe_usuario}
        className="btn-secondary text-sm"
        style={{ width: '100%' }}
      >
        {cargando ? 'Consultando…' : '🔌 Ver estado de conexión'}
      </button>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            background: '#FCEBEB',
            color: '#791F1F',
          }}
        >
          <p style={{ margin: 0 }}>⚠️ {error}</p>
          <button onClick={aceptar} className="btn-primary text-xs" style={{ marginTop: 8 }}>
            Aceptar
          </button>
        </div>
      )}

      {estado && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg p-3" style={{ background: '#F5F7F6' }}>
            <p className="text-xs text-brand-400 mb-1">PPPoE (MikroTik)</p>
            {estado.pppoe?.error ? (
              <p className="text-sm" style={{ color: '#791F1F' }}>⚠️ {estado.pppoe.error}</p>
            ) : (
              <>
                <p className="text-sm font-semibold">
                  {estado.pppoe.online ? '🟢 Conectado' : '🔴 Desconectado'}
                  {!estado.pppoe.online && estado.pppoe.desde && (
                    <span className="font-normal text-brand-400">
                      {' '}
                      · desde hace {formatearDuracion(estado.pppoe.desde)}
                    </span>
                  )}
                </p>
                {estado.pppoe.online && estado.pppoe.conectadoDesde && (
                  <p className="text-xs text-brand-400 mt-1">
                    Conectado desde{' '}
                    {new Date(estado.pppoe.conectadoDesde).toLocaleString('es-BO', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}{' '}
                    (hace {formatearDuracion(estado.pppoe.conectadoDesde)})
                  </p>
                )}
                {estado.pppoe.online && estado.pppoe.ip && (
                  <p className="text-xs text-brand-400 mt-2">
                    IP asignada:{' '}
                    <span className="block mt-1">
                      <EnlaceIp ip={estado.pppoe.ip} />
                    </span>
                  </p>
                )}
              </>
            )}
          </div>

          {esTarija && (
            <div className="rounded-lg p-3" style={{ background: '#F5F7F6' }}>
              <p className="text-xs text-brand-400 mb-1">OLT (V-Sol)</p>
              {estado.olt?.error ? (
                <p className="text-sm" style={{ color: '#791F1F' }}>⚠️ {estado.olt.error}</p>
              ) : estado.olt && estado.olt.encontrado === false ? (
                <p className="text-sm text-brand-400">No se pudo leer el estado de la ONU.</p>
              ) : (
                <>
                  <p className="text-sm font-semibold">
                    {estado.olt?.online ? '🟢 En línea' : '🔴 Desconectada'}
                  </p>
                  {(estado.olt?.rxDbm !== null && estado.olt?.rxDbm !== undefined) && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="rounded p-2 text-center" style={{ background: '#fff' }}>
                        <p className="text-xs text-brand-400">Rx</p>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: COLOR_NIVEL_OLT[estado.olt.nivelRx] || '#666' }}
                        >
                          {estado.olt.rxDbm}
                        </p>
                        <p className="text-xs text-brand-400">dBm</p>
                      </div>
                      <div className="rounded p-2 text-center" style={{ background: '#fff' }}>
                        <p className="text-xs text-brand-400">Tx</p>
                        <p className="text-sm font-semibold">{estado.olt.txDbm ?? '—'}</p>
                        <p className="text-xs text-brand-400">dBm</p>
                      </div>
                      <div className="rounded p-2 text-center" style={{ background: '#fff' }}>
                        <p className="text-xs text-brand-400">Temp.</p>
                        <p className="text-sm font-semibold">{estado.olt.temperaturaC ?? '—'}</p>
                        <p className="text-xs text-brand-400">°C</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <button onClick={aceptar} className="btn-primary text-xs">
            Aceptar
          </button>
        </div>
      )}
    </div>
  );
}

export default function FichaClientePage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = usePerfil();
  const { user } = useAuth();
  const codigo = params.codigo;

  const [cliente, setCliente] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [mostrarBoleta, setMostrarBoleta] = useState(false);
  const [mostrarContrato, setMostrarContrato] = useState(false);
  const [mostrarBorrar, setMostrarBorrar] = useState(false);
  const [opticoOlt, setOpticoOlt] = useState(null);
  const [planes, setPlanes] = useState([]);

  useEffect(() => {
    supabase
      .from('planes')
      .select('*')
      .then(({ data }) => setPlanes(data || []));
  }, []);

  // Solo los planes de la misma ciudad que tiene el formulario en este
  // momento — así no se puede elegir por error un plan de la otra sede
  // (su "Perfil MikroTik" no existiría en el router de esta ciudad).
  const planesDeLaCiudad = planes.filter((p) => (p.ciudad || 'El Alto') === (form?.ciudad || 'El Alto'));

  function aplicarPlan(nombrePlan) {
    const p = planesDeLaCiudad.find((pl) => pl.nombre === nombrePlan);
    if (p) {
      setForm({ ...form, plan: p.nombre, velocidad: p.velocidad, frecuencia: p.frecuencia, precio: p.precio });
    } else {
      setForm({ ...form, plan: nombrePlan });
    }
  }

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true);
 
    const { data: c } = await supabase
      .from('v_clientes_estado')
      .select('*')
      .eq('codigo', codigo)
      .single();
    setCliente(c || null);
    setForm(c || null);

    if (c) {
      const { data: pagosData } = await supabase
        .from('pagos')
        .select('id, fecha_pago, monto, tipo_pago, mes_corresponde, meses_cubiertos')
        .eq('cliente_id', c.id)
        .order('fecha_pago', { ascending: false });
      setPagos(pagosData || []);
    }

    const { data: cfgRows } = await supabase.from('config').select('*');
    const cfg = {};
    (cfgRows || []).forEach((r) => (cfg[r.clave] = r.valor));
    setConfig(cfg);

    setLoading(false);
  }

  useEffect(() => {
    if (codigo) cargar();
  }, [codigo]);

  async function guardar() {
    if (!form) return;
    setGuardando(true);
    setMsg('');
    const { error } = await supabase
      .from('clientes')
      .update({
        nombre: form.nombre,
        telefono: form.telefono,
        telefono2: form.telefono2,
        ciudad: form.ciudad,
        dia_pago: form.dia_pago ? Number(form.dia_pago) : null,
        activo: form.activo,
        plan: form.plan,
        frecuencia: form.frecuencia,
        precio: form.precio ? Number(form.precio) : 0,
        velocidad: form.velocidad,
        direccion: form.direccion,
        ci: form.ci,
        costo_instalacion: form.costo_instalacion ? Number(form.costo_instalacion) : 0,
        pppoe_usuario: form.pppoe_usuario,
        pppoe_password: form.pppoe_password,
        ip_asignada: form.ip_asignada,
        olt_puerto_pon: form.olt_puerto_pon ? Number(form.olt_puerto_pon) : null,
        olt_onu_id: form.olt_onu_id ? Number(form.olt_onu_id) : null,
        olt_sn: form.olt_sn,
      })
      .eq('id', cliente.id);
    setGuardando(false);
    if (error) {
      setMsg('Error al guardar: ' + error.message);
      return;
    }
    setMsg('Cambios guardados correctamente.');
    setEditando(false);
    cargar();
  }

  async function borrarCliente() {
    setMsg('');
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id);
    if (error) {
      setMostrarBorrar(false);
      setMsg('Error al borrar: ' + error.message);
      return;
    }
    router.push('/clientes');
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-brand-500">Cargando ficha…</p>
      </AppShell>
    );
  }

  if (!cliente) {
    return (
      <AppShell>
        <p className="text-brand-500">No se encontró el cliente {codigo}.</p>
        <Link href="/clientes" className="text-brand-600 hover:underline">
          ← Volver a Clientes
        </Link>
      </AppShell>
    );
  }

  const mensaje = construirMensaje(cliente, config, config.empresa_nombre);
  const wa = linkWhatsApp(cliente.telefono, mensaje);
  const wa2 = linkWhatsApp(cliente.telefono2, mensaje);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/clientes" className="text-brand-500 text-sm hover:underline">
            ← Volver a Clientes
          </Link>
          <h1 className="font-display text-2xl font-bold text-brand-800 mt-1">{cliente.nombre}</h1>
          <p className="text-brand-500 text-sm font-mono">{cliente.codigo}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn-whatsapp">
              📲 WhatsApp
            </a>
          )}
          {wa2 && (
            <a href={wa2} target="_blank" rel="noreferrer" className="btn-whatsapp" title={`Teléfono 2: ${cliente.telefono2}`}>
              📲 WhatsApp 2
            </a>
          )}
          <button onClick={() => setMostrarContrato(true)} className="btn-secondary">
            📄 Generar contrato
          </button>
          <button onClick={() => setMostrarBoleta(true)} className="btn-secondary">
            🧾 Boleta de instalación
          </button>
          {isAdmin && !editando && (
            <button onClick={() => setEditando(true)} className="btn-primary">
              ✏️ Editar
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold text-brand-700 mb-3">Datos del cliente</h2>

          {!editando ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-brand-400">Teléfono</span>
                <p className="font-medium">{cliente.telefono || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Teléfono 2</span>
                <p className="font-medium">{cliente.telefono2 || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Ciudad</span>
                <p className="font-medium">{cliente.ciudad || 'El Alto'}</p>
              </div>
              <div>
                <span className="text-brand-400">Día de pago</span>
                <p className="font-medium">{cliente.dia_pago ?? '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Estado</span>
                <p className="font-medium">{cliente.activo ? cliente.estado : 'Inactivo'}</p>
              </div>
              <div>
                <span className="text-brand-400">Plan</span>
                <p className="font-medium">{cliente.plan || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Frecuencia</span>
                <p className="font-medium">{cliente.frecuencia || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Precio</span>
                <p className="font-medium">{formatBs(cliente.precio)}</p>
              </div>
              <div>
                <span className="text-brand-400">Velocidad</span>
                <p className="font-medium">{cliente.velocidad || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Dirección</span>
                <p className="font-medium">{cliente.direccion || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">CI</span>
                <p className="font-medium">{cliente.ci || '—'}</p>
              </div>
              <div>
                <span className="text-brand-400">Costo de instalación</span>
                <p className="font-medium">{formatBs(cliente.costo_instalacion || 0)}</p>
              </div>
              <div>
                <span className="text-brand-400">Activo</span>
                <p className="font-medium">{cliente.activo ? 'Sí' : 'No'}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={form.telefono || ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div>
                <label className="label">Teléfono 2 (opcional)</label>
                <input className="input" value={form.telefono2 || ''} onChange={(e) => setForm({ ...form, telefono2: e.target.value })} />
              </div>
              <div>
                <label className="label">Ciudad</label>
                <select className="input" value={form.ciudad || 'El Alto'} onChange={(e) => setForm({ ...form, ciudad: e.target.value })}>
                  <option value="El Alto">El Alto</option>
                  <option value="Tarija">Tarija</option>
                </select>
              </div>
              <div>
                <label className="label">Día de pago</label>
                <input type="number" min="1" max="31" className="input" value={form.dia_pago ?? ''} onChange={(e) => setForm({ ...form, dia_pago: e.target.value })} />
              </div>
              <div>
                <label className="label">Plan</label>
                <select className="input" value={form.plan || ''} onChange={(e) => aplicarPlan(e.target.value)}>
                  <option value="">— Selecciona un plan —</option>
                  {planesDeLaCiudad.map((p) => (
                    <option key={p.id} value={p.nombre}>
                      {p.nombre} ({p.velocidad}, Bs {p.precio})
                    </option>
                  ))}
                  {form.plan && !planesDeLaCiudad.some((p) => p.nombre === form.plan) && (
                    <option value={form.plan}>{form.plan} (no está en el catálogo)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="label">Frecuencia</label>
                <input className="input" value={form.frecuencia || ''} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} />
              </div>
              <div>
                <label className="label">Precio (Bs)</label>
                <input type="number" step="0.01" className="input" value={form.precio ?? ''} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
              </div>
              <div>
                <label className="label">Velocidad</label>
                <input className="input" value={form.velocidad || ''} onChange={(e) => setForm({ ...form, velocidad: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Dirección</label>
                <input className="input" value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="label">CI</label>
                <input className="input" value={form.ci || ''} onChange={(e) => setForm({ ...form, ci: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="label">Costo de instalación (Bs)</label>
                <input type="number" step="0.01" className="input" value={form.costo_instalacion ?? ''} onChange={(e) => setForm({ ...form, costo_instalacion: e.target.value })} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={!!form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                <label htmlFor="activo" className="text-sm">Cliente activo</label>
              </div>

              {msg && <p className="col-span-2 text-sm text-brand-600">{msg}</p>}

              <div className="col-span-2 flex gap-2 mt-2 flex-wrap items-center">
                <button onClick={guardar} disabled={guardando} className="btn-primary">
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => {
                    setForm(cliente);
                    setEditando(false);
                    setMsg('');
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setMostrarBorrar(true)}
                    className="btn-secondary text-sm ml-auto"
                    style={{ color: '#791F1F', borderColor: '#f3c9c9' }}
                  >
                    🗑️ Borrar cliente
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <PanelApuntes clienteId={cliente.id} userEmail={user?.email} />

        <div className="card p-5">
          <h2 className="font-semibold text-brand-700 mb-3">Historial de pagos</h2>
          {pagos.length === 0 ? (
            <p className="text-sm text-brand-400">Sin pagos registrados.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pagos.map((p) => (
                <li key={p.id} className="border-b border-brand-50 pb-2">
                  <div className="flex justify-between">
                    <span>{new Date(p.fecha_pago).toLocaleDateString('es-BO')}</span>
                    <span className="font-medium">{formatBs(p.monto)}</span>
                  </div>
                  <div className="text-xs text-brand-400">
                    {p.tipo_pago || 'Mensual'}
                    {p.mes_corresponde
                      ? ' · ' + new Date(p.mes_corresponde).toLocaleDateString('es-BO', { month: 'short', year: 'numeric' })
                      : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isAdmin && opticoOlt && (
          <>
            <div className="card p-5">
              <h2 className="font-semibold text-brand-700 mb-4">📶 Potencia óptica — {cliente.nombre}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="rounded-lg p-4 text-center" style={{ background: '#F5F7F6' }}>
                <p className="text-xs text-brand-400 mb-1">Estado</p>
                <p className="text-lg font-semibold">
                  {opticoOlt.online ? '🟢 En línea' : opticoOlt.encontrado ? '🔴 Desconectada' : '—'}
                </p>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: '#F5F7F6' }}>
                <p className="text-xs text-brand-400 mb-1">Rx (recibida en OLT)</p>
                <p className="text-2xl font-semibold" style={{ color: COLOR_NIVEL_OLT[opticoOlt.nivelRx] || '#666' }}>
                  {opticoOlt.rxDbm ?? '—'}
                </p>
                <p className="text-xs text-brand-400">dBm · {opticoOlt.nivelRx}</p>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: '#F5F7F6' }}>
                <p className="text-xs text-brand-400 mb-1">Tx (ONU)</p>
                <p className="text-2xl font-semibold">{opticoOlt.txDbm ?? '—'}</p>
                <p className="text-xs text-brand-400">dBm</p>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: '#F5F7F6' }}>
                <p className="text-xs text-brand-400 mb-1">Temperatura</p>
                <p className="text-2xl font-semibold">{opticoOlt.temperaturaC ?? '—'}</p>
                <p className="text-xs text-brand-400">°C</p>
              </div>
              <div className="rounded-lg p-4 text-center" style={{ background: '#F5F7F6' }}>
                <p className="text-xs text-brand-400 mb-1">Voltaje</p>
                <p className="text-2xl font-semibold">{opticoOlt.voltajeV ?? '—'}</p>
                <p className="text-xs text-brand-400">V</p>
              </div>
            </div>

            {opticoOlt.salidaCruda && (
              <details className="mt-4 text-xs text-brand-400">
                <summary className="cursor-pointer select-none">Ver salida cruda de la OLT (para depurar)</summary>
                <pre
                  className="mt-2 p-3 rounded whitespace-pre-wrap"
                  style={{ background: '#F5F7F6', fontSize: 11, maxHeight: 300, overflowY: 'auto' }}
                >
                  {opticoOlt.salidaCruda}
                </pre>
              </details>
            )}
            </div>
          </>
        )}
        </div>

        <div className="md:col-span-1 space-y-6">
          {isAdmin && !editando && <PanelEstadoConexion cliente={cliente} />}

          {isAdmin && !editando && cliente.pppoe_usuario && (
            <GraficoTrafico
              titulo={`📡 Tráfico en tiempo real — ${cliente.nombre}`}
              endpoint="/api/mikrotik/trafico-cliente"
              body={{ clienteId: cliente.id }}
            />
          )}

          <div className="card p-5">
            <h2 className="font-semibold text-brand-700 mb-3">Configuración MikroTik</h2>

            {!editando ? (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-brand-400">Usuario PPPoE</span>
                  <p className="font-mono font-medium">{cliente.pppoe_usuario || '—'}</p>
                </div>
                <div>
                  <span className="text-brand-400">Contraseña PPPoE</span>
                  <p className="font-mono font-medium flex items-center gap-2">
                    {cliente.pppoe_password
                      ? verPassword
                        ? cliente.pppoe_password
                        : '•'.repeat(Math.min(cliente.pppoe_password.length, 10))
                      : '—'}
                    {cliente.pppoe_password && (
                      <button
                        type="button"
                        onClick={() => setVerPassword(!verPassword)}
                        className="text-brand-500 text-xs hover:underline font-sans"
                      >
                        {verPassword ? 'Ocultar' : 'Ver'}
                      </button>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-brand-400">IP asignada</span>
                  <p className="font-mono font-medium">
                    <EnlaceIp ip={cliente.ip_asignada} />
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Usuario PPPoE</label>
                  <input className="input" value={form.pppoe_usuario || ''} onChange={(e) => setForm({ ...form, pppoe_usuario: e.target.value.toLowerCase() })} />
                </div>
                <div>
                  <label className="label">Contraseña PPPoE</label>
                  <input className="input" value={form.pppoe_password || ''} onChange={(e) => setForm({ ...form, pppoe_password: e.target.value.toLowerCase() })} />
                </div>
                <div>
                  <label className="label">IP asignada</label>
                  <input className="input" value={form.ip_asignada || ''} onChange={(e) => setForm({ ...form, ip_asignada: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {isAdmin && !editando && <PanelMikrotik cliente={cliente} onRecargar={cargar} />}

          {isAdmin && !editando && (
            <PanelOlt cliente={cliente} onRecargar={cargar} optico={opticoOlt} setOptico={setOpticoOlt} />
          )}

          <div className="card p-5">
            <h2 className="font-semibold text-brand-700 mb-3">Configuración OLT</h2>

            {!editando ? (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-brand-400">Puerto PON</span>
                  <p className="font-mono font-medium">{cliente.olt_puerto_pon ?? '—'}</p>
                </div>
                <div>
                  <span className="text-brand-400">ID de ONU</span>
                  <p className="font-mono font-medium">{cliente.olt_onu_id ?? '—'}</p>
                </div>
                <div>
                  <span className="text-brand-400">N° de serie (SN)</span>
                  <p className="font-mono font-medium">{cliente.olt_sn || '—'}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Puerto PON</label>
                  <input type="number" min="1" className="input" value={form.olt_puerto_pon ?? ''} onChange={(e) => setForm({ ...form, olt_puerto_pon: e.target.value })} />
                </div>
                <div>
                  <label className="label">ID de ONU</label>
                  <input type="number" min="1" className="input" value={form.olt_onu_id ?? ''} onChange={(e) => setForm({ ...form, olt_onu_id: e.target.value })} />
                </div>
                <div>
                  <label className="label">N° de serie (SN)</label>
                  <input className="input" value={form.olt_sn || ''} onChange={(e) => setForm({ ...form, olt_sn: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {mostrarBoleta && (
        <ModalBoleta cliente={cliente} empresaNombre={config.empresa_nombre} onClose={() => setMostrarBoleta(false)} />
      )}
      {mostrarContrato && (
        <ModalContrato cliente={cliente} empresaNombre={config.empresa_nombre} onClose={() => setMostrarContrato(false)} />
      )}
      {mostrarBorrar && (
        <ModalBorrarCliente cliente={cliente} onConfirmar={borrarCliente} onClose={() => setMostrarBorrar(false)} />
      )}
    </AppShell>
  );
}