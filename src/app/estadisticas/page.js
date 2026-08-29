'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabaseClient';
import { formatBs, parsearFechaLocal } from '@/lib/utils';
import { useSucursalActiva } from '@/lib/useSucursalActiva';

export default function EstadisticasPage() {
  const { sucursalActiva, esFija } = useSucursalActiva();
  const [pagos, setPagos] = useState(null);
  const [ciudad, setCiudad] = useState('todas');

  useEffect(() => {
    if (sucursalActiva) setCiudad(sucursalActiva === 'Todas' ? 'todas' : sucursalActiva);
  }, [sucursalActiva]);

  useEffect(() => {
    supabase
      .from('pagos')
      .select('monto, fecha_pago, cliente_id, con_factura, clientes(ciudad)')
      .then(({ data }) => setPagos(data || []));
  }, []);

  const filas = useMemo(() => {
    if (!pagos) return [];
    const anioActual = new Date().getFullYear();
    const pagosF = pagos.filter((p) => {
      if (ciudad !== 'todas' && p.clientes?.ciudad !== ciudad) return false;
      return parsearFechaLocal(p.fecha_pago).getFullYear() === anioActual;
    });

    const porMes = {};
    pagosF.forEach((p) => {
      const f = parsearFechaLocal(p.fecha_pago);
      const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
      if (!porMes[clave]) {
        porMes[clave] = {
          mes: clave,
          recaudado: 0,
          facturado: 0,
          no_facturado: 0,
          n_pagos: 0,
          clientesSet: new Set(),
        };
      }
      const monto = Number(p.monto);
      porMes[clave].recaudado += monto;
      if (p.con_factura === true) {
        porMes[clave].facturado += monto;
      } else {
        porMes[clave].no_facturado += monto;
      }
      porMes[clave].n_pagos += 1;
      porMes[clave].clientesSet.add(p.cliente_id);
    });

    return Object.values(porMes)
      .map((m) => ({
        mes: m.mes,
        recaudado: m.recaudado,
        facturado: m.facturado,
        no_facturado: m.no_facturado,
        n_pagos: m.n_pagos,
        n_clientes: m.clientesSet.size,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [pagos, ciudad]);

  const maxRecaudado = Math.max(1, ...filas.map((f) => Number(f.recaudado)));
  const totalAnio = filas.reduce((acc, f) => acc + Number(f.recaudado), 0);
  const totalFacturado = filas.reduce((acc, f) => acc + Number(f.facturado), 0);
  const totalNoFacturado = filas.reduce((acc, f) => acc + Number(f.no_facturado), 0);
  const totalPagos = filas.reduce((acc, f) => acc + Number(f.n_pagos), 0);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="font-display text-2xl font-bold text-brand-800">Estadísticas</h1>
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
      <p className="text-brand-500 mb-6">Recaudación mensual del año en curso</p>

      <div className="card p-5 mb-6">
        <div className="flex items-end gap-3 h-48">
          {filas.map((f) => (
            <div key={f.mes} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="text-xs text-brand-600 mb-1">{formatBs(f.recaudado)}</div>
              <div
                className="w-full bg-brand-400 rounded-t-md"
                style={{ height: `${(Number(f.recaudado) / maxRecaudado) * 100}%`, minHeight: 2 }}
              />
              <div className="text-xs text-brand-500 mt-1">
                {parsearFechaLocal(f.mes + '-01').toLocaleDateString('es-BO', { month: 'short' })}
              </div>
            </div>
          ))}
          {filas.length === 0 && <p className="text-brand-400">Aún no hay pagos registrados este año.</p>}
        </div>
      </div>

      <div className="card overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brand-500 border-b border-brand-100">
              <th className="p-3">Mes</th>
              <th className="p-3">Recaudado (Bs)</th>
              <th className="p-3">Facturado (Bs)</th>
              <th className="p-3">No facturado (Bs)</th>
              <th className="p-3">N° pagos</th>
              <th className="p-3">Clientes que pagaron</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.mes} className="border-b border-brand-50">
                <td className="p-3 capitalize">
                  {parsearFechaLocal(f.mes + '-01').toLocaleDateString('es-BO', { month: 'long', year: 'numeric' })}
                </td>
                <td className="p-3">{formatBs(f.recaudado)}</td>
                <td className="p-3">{formatBs(f.facturado)}</td>
                <td className="p-3">{formatBs(f.no_facturado)}</td>
                <td className="p-3">{f.n_pagos}</td>
                <td className="p-3">{f.n_clientes}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-brand-50">
              <td className="p-3">Total año</td>
              <td className="p-3">{formatBs(totalAnio)}</td>
              <td className="p-3">{formatBs(totalFacturado)}</td>
              <td className="p-3">{formatBs(totalNoFacturado)}</td>
              <td className="p-3">{totalPagos}</td>
              <td className="p-3"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}