'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import GraficoTrafico from '@/components/GraficoTrafico';
import PanelTraficoEnlaces from '@/components/PanelTraficoEnlaces';
import { supabase } from '@/lib/supabaseClient';
import { formatBs, parsearFechaLocal } from '@/lib/utils';
import { useSucursalActiva } from '@/lib/useSucursalActiva';
import { usePerfil } from '@/lib/usePerfil';

function StatCard({ label, value, accent }) {
  return (
    <div className="card p-5">
      <div className="text-brand-500 text-sm">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ? 'text-accent' : 'text-brand-800'}`}>
        {value}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { sucursalActiva, esFija } = useSucursalActiva();
  const { isAdmin } = usePerfil();
  const [clientes, setClientes] = useState(null);
  const [pagos, setPagos] = useState(null);
  const [trabajos, setTrabajos] = useState(null);
  const [ciudad, setCiudad] = useState('todas');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sucursalActiva) setCiudad(sucursalActiva === 'Todas' ? 'todas' : sucursalActiva);
  }, [sucursalActiva]);

  useEffect(() => {
    async function load() {
      const [{ data: c, error: e1 }, { data: p, error: e2 }, { data: t, error: e3 }] = await Promise.all([
        supabase.from('v_clientes_estado').select('*'),
        supabase.from('pagos').select('monto, fecha_pago, tipo_pago, con_factura, clientes(ciudad)'),
        supabase.from('trabajos_adicionales').select('monto, costo_materiales, fecha, ciudad'),
      ]);
      if (e1 || e2 || e3) setError((e1 || e2 || e3).message);
      setClientes(c || []);
      setPagos(p || []);
      setTrabajos(t || []);
    }
    load();
  }, []);

  const kpi = useMemo(() => {
    if (!clientes || !pagos || !trabajos) return null;
    const clientesF = ciudad === 'todas' ? clientes : clientes.filter((c) => c.ciudad === ciudad);
    const pagosF = ciudad === 'todas' ? pagos : pagos.filter((p) => p.clientes?.ciudad === ciudad);
    const trabajosF = ciudad === 'todas' ? trabajos : trabajos.filter((t) => (t.ciudad || 'El Alto') === ciudad);

    const hoy = new Date();
    const esMesActual = (fecha) => {
      const f = parsearFechaLocal(fecha);
      return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
    };

    const pagosMensualidad = pagosF.filter((p) => p.tipo_pago !== 'Costo de instalación');
    const pagosInstalacion = pagosF.filter((p) => p.tipo_pago === 'Costo de instalación');

    const cobradoMes = pagosMensualidad
      .filter((p) => esMesActual(p.fecha_pago))
      .reduce((a, p) => a + Number(p.monto), 0);
    const ingresoHistorico = pagosMensualidad.reduce((a, p) => a + Number(p.monto), 0);
    const ingresoInstalaciones = pagosInstalacion.reduce((a, p) => a + Number(p.monto), 0);
    const ticketPromedio = pagosMensualidad.length ? ingresoHistorico / pagosMensualidad.length : 0;

    const pagosMesActual = pagosMensualidad.filter((p) => esMesActual(p.fecha_pago));
    const facturadoMes = pagosMesActual
      .filter((p) => p.con_factura === true)
      .reduce((a, p) => a + Number(p.monto), 0);
    const noFacturadoMes = pagosMesActual
      .filter((p) => p.con_factura !== true)
      .reduce((a, p) => a + Number(p.monto), 0);

    const facturadoTotal = pagosMensualidad
      .filter((p) => p.con_factura === true)
      .reduce((a, p) => a + Number(p.monto), 0);
    const noFacturadoTotal = pagosMensualidad
      .filter((p) => p.con_factura !== true)
      .reduce((a, p) => a + Number(p.monto), 0);

    // Trabajos adicionales
    const trabajosMes = trabajosF.filter((t) => esMesActual(t.fecha));
    const ingresoTrabajosMes = trabajosMes.reduce((a, t) => a + Number(t.monto || 0), 0);
    const costoTrabajosMes = trabajosMes.reduce((a, t) => a + Number(t.costo_materiales || 0), 0);
    const ingresoTrabajosTotal = trabajosF.reduce((a, t) => a + Number(t.monto || 0), 0);
    const costoTrabajosTotal = trabajosF.reduce((a, t) => a + Number(t.costo_materiales || 0), 0);

    return {
      total_clientes: clientesF.length,
      clientes_activos: clientesF.filter((c) => c.activo).length,
      clientes_inactivos: clientesF.filter((c) => !c.activo).length,
      clientes_al_dia: clientesF.filter((c) => c.activo && c.estado === 'Al día').length,
      clientes_por_vencer: clientesF.filter((c) => c.activo && c.estado === 'Por vencer').length,
      clientes_vencidos: clientesF.filter((c) => c.activo && c.estado === 'Vencido').length,
      cobrado_mes_actual: cobradoMes,
      ingreso_historico: ingresoHistorico,
      ingreso_instalaciones: ingresoInstalaciones,
      ticket_promedio: ticketPromedio,
      facturado_mes: facturadoMes,
      no_facturado_mes: noFacturadoMes,
      facturado_total: facturadoTotal,
      no_facturado_total: noFacturadoTotal,
      ingreso_trabajos_mes: ingresoTrabajosMes,
      costo_trabajos_mes: costoTrabajosMes,
      ganancia_trabajos_mes: ingresoTrabajosMes - costoTrabajosMes,
      ingreso_trabajos_total: ingresoTrabajosTotal,
      costo_trabajos_total: costoTrabajosTotal,
      ganancia_trabajos_total: ingresoTrabajosTotal - costoTrabajosTotal,
    };
  }, [clientes, pagos, trabajos, ciudad]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="font-display text-2xl font-bold text-brand-800">Dashboard</h1>
        {esFija ? (
          <span className="text-sm text-brand-500">📍 Sucursal: {ciudad}</span>
        ) : (
          <select className="input md:max-w-[200px]" value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
            <option value="todas">Todas las ciudades</option>
            <option value="El Alto">El Alto</option>
            <option value="Tarija">Tarija</option>
          </select>
        )}
      </div>
      <p className="text-brand-500 mb-6">Resumen general de JapTom Telecom</p>

      {error && (
        <div className="card p-4 mb-4 text-red-600 text-sm">
          No se pudo cargar el dashboard: {error}
        </div>
      )}

      {!kpi && !error && <p className="text-brand-400">Cargando indicadores…</p>}

      {kpi && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total clientes" value={kpi.total_clientes} />
            <StatCard label="Clientes activos" value={kpi.clientes_activos} />
            <StatCard label="Clientes inactivos" value={kpi.clientes_inactivos} />
            <StatCard label="Al día" value={kpi.clientes_al_dia} />
            <StatCard label="Por vencer (1-2 días)" value={kpi.clientes_por_vencer} />
            <StatCard label="Vencidos" value={kpi.clientes_vencidos} />
            <StatCard label="Cobrado este mes" value={formatBs(kpi.cobrado_mes_actual)} accent />
            <StatCard label="Ingreso histórico (mensualidades)" value={formatBs(kpi.ingreso_historico)} />
            <StatCard label="Ingreso por instalaciones" value={formatBs(kpi.ingreso_instalaciones)} />
            <StatCard label="Ticket promedio" value={formatBs(kpi.ticket_promedio)} />
          </div>

          <h2 className="font-display text-lg font-bold text-brand-800 mt-8 mb-3">Facturación (internet) — este mes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Facturado (este mes)" value={formatBs(kpi.facturado_mes)} />
            <StatCard label="No facturado (este mes)" value={formatBs(kpi.no_facturado_mes)} />
          </div>

          <h2 className="font-display text-lg font-bold text-brand-800 mt-8 mb-3">Facturación (internet) — total histórico</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Facturado (total histórico)" value={formatBs(kpi.facturado_total)} />
            <StatCard label="No facturado (total histórico)" value={formatBs(kpi.no_facturado_total)} />
            <StatCard label="Ingresos totales brutos (internet)" value={formatBs(kpi.ingreso_historico)} accent />
          </div>

          <h2 className="font-display text-lg font-bold text-brand-800 mt-8 mb-3">🛠️ Trabajos adicionales — este mes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Ingresos (este mes)" value={formatBs(kpi.ingreso_trabajos_mes)} />
            <StatCard label="Costo materiales (este mes)" value={formatBs(kpi.costo_trabajos_mes)} />
            <StatCard label="Ganancia neta (este mes)" value={formatBs(kpi.ganancia_trabajos_mes)} accent />
          </div>

          <h2 className="font-display text-lg font-bold text-brand-800 mt-8 mb-3">🛠️ Trabajos adicionales — total histórico</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Ingresos (total histórico)" value={formatBs(kpi.ingreso_trabajos_total)} />
            <StatCard label="Costo materiales (total histórico)" value={formatBs(kpi.costo_trabajos_total)} />
            <StatCard label="Ganancia neta (total histórico)" value={formatBs(kpi.ganancia_trabajos_total)} accent />
          </div>
        </>
      )}

      {isAdmin && ciudad === 'Tarija' && (
        <div className="mt-6">
          <GraficoTrafico
            titulo="📡 Tráfico en tiempo real — MikroTik Tarija"
            endpoint="/api/mikrotik/trafico-router"
            body={{ ciudad: 'Tarija' }}
          />
        </div>
      )}

      {isAdmin && ciudad === 'El Alto' && (
        <div className="mt-6">
          <PanelTraficoEnlaces titulo="📡 Tráfico en tiempo real — MikroTik El Alto (por proveedor)" ciudad="El Alto" />
        </div>
      )}
    </AppShell>
  );
}