'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { formatBs, parsearFechaLocal } from '@/lib/utils';
import { useSucursalActiva } from '@/lib/useSucursalActiva';

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
  const [clientes, setClientes] = useState(null);
  const [pagos, setPagos] = useState(null);
  const [ciudad, setCiudad] = useState('todas');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sucursalActiva) setCiudad(sucursalActiva === 'Todas' ? 'todas' : sucursalActiva);
  }, [sucursalActiva]);

  useEffect(() => {
    async function load() {
      const [{ data: c, error: e1 }, { data: p, error: e2 }] = await Promise.all([
        supabase.from('v_clientes_estado').select('*'),
        supabase.from('pagos').select('monto, fecha_pago, clientes(ciudad)'),
      ]);
      if (e1 || e2) setError((e1 || e2).message);
      setClientes(c || []);
      setPagos(p || []);
    }
    load();
  }, []);

  const kpi = useMemo(() => {
    if (!clientes || !pagos) return null;
    const clientesF = ciudad === 'todas' ? clientes : clientes.filter((c) => c.ciudad === ciudad);
    const pagosF = ciudad === 'todas' ? pagos : pagos.filter((p) => p.clientes?.ciudad === ciudad);

    const hoy = new Date();
    const esMesActual = (fecha) => {
      const f = parsearFechaLocal(fecha);
      return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
    };

    const cobradoMes = pagosF.filter((p) => esMesActual(p.fecha_pago)).reduce((a, p) => a + Number(p.monto), 0);
    const ingresoHistorico = pagosF.reduce((a, p) => a + Number(p.monto), 0);
    const ticketPromedio = pagosF.length ? ingresoHistorico / pagosF.length : 0;

    return {
      total_clientes: clientesF.length,
      clientes_activos: clientesF.filter((c) => c.activo).length,
      clientes_inactivos: clientesF.filter((c) => !c.activo).length,
      clientes_al_dia: clientesF.filter((c) => c.activo && c.estado === 'Al día').length,
      clientes_vencidos: clientesF.filter((c) => c.activo && c.estado === 'Vencido').length,
      cobrado_mes_actual: cobradoMes,
      ingreso_historico: ingresoHistorico,
      ticket_promedio: ticketPromedio,
    };
  }, [clientes, pagos, ciudad]);

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total clientes" value={kpi.total_clientes} />
          <StatCard label="Clientes activos" value={kpi.clientes_activos} />
          <StatCard label="Clientes inactivos" value={kpi.clientes_inactivos} />
          <StatCard label="Al día" value={kpi.clientes_al_dia} />
          <StatCard label="Vencidos" value={kpi.clientes_vencidos} />
          <StatCard label="Cobrado este mes" value={formatBs(kpi.cobrado_mes_actual)} accent />
          <StatCard label="Ingreso histórico total" value={formatBs(kpi.ingreso_historico)} />
          <StatCard label="Ticket promedio" value={formatBs(kpi.ticket_promedio)} />
        </div>
      )}
    </AppShell>
  );
}
