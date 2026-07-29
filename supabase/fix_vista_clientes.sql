-- ============================================================
-- Corrección: la vista v_clientes_estado se creó antes de agregar
-- las columnas "ciudad" y "pppoe_usuario", así que no las incluía.
-- Este script la vuelve a crear para que las tome en cuenta.
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

drop view if exists v_dashboard;
drop view if exists v_clientes_estado;

create view v_clientes_estado as
select c.*,
  coalesce(pm.total,0) as pagado_mes_actual,
  case
    when coalesce(pm.total,0) >= c.precio and c.precio > 0 then 'Al día'
    else 'Vencido'
  end as estado
from clientes c
left join v_pagos_mes_actual pm on pm.cliente_id = c.id;

create view v_dashboard as
select
  (select count(*) from clientes) as total_clientes,
  (select count(*) from clientes where activo) as clientes_activos,
  (select count(*) from clientes where not activo) as clientes_inactivos,
  (select count(*) from v_clientes_estado where activo and estado='Al día') as clientes_al_dia,
  (select count(*) from v_clientes_estado where activo and estado='Vencido') as clientes_vencidos,
  (select coalesce(sum(monto),0) from pagos where date_trunc('month',fecha_pago)=date_trunc('month',current_date)) as cobrado_mes_actual,
  (select coalesce(sum(monto),0) from pagos) as ingreso_historico,
  (select coalesce(round(avg(monto),2),0) from pagos) as ticket_promedio;
