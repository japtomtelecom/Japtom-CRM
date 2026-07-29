-- ============================================================
-- CRM JapTom Telecom — Esquema de base de datos (Supabase/Postgres)
-- ============================================================
create extension if not exists pgcrypto;

-- Catálogo de planes (referencia para autocompletar nuevos clientes)
create table if not exists planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  velocidad text,
  frecuencia text,
  precio numeric not null default 0
);

-- Clientes
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,          -- ej. CSB00002
  nombre text not null,
  telefono text,
  dia_pago int,
  activo boolean not null default true,
  plan text,
  frecuencia text,
  precio numeric not null default 0,
  velocidad text,
  direccion text,
  created_at timestamptz not null default now()
);
create index if not exists idx_clientes_nombre on clientes using gin (to_tsvector('spanish', nombre));
create index if not exists idx_clientes_codigo on clientes (codigo);

-- Pagos
create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  fecha_pago date not null,
  monto numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pagos_cliente on pagos (cliente_id);
create index if not exists idx_pagos_fecha on pagos (fecha_pago);

-- Configuración general (nombre empresa, WhatsApp, datos QR/banco, plantillas de mensaje)
create table if not exists config (
  clave text primary key,
  valor text
);

insert into config (clave, valor) values
  ('empresa_nombre', 'JapTom Telecom'),
  ('empresa_slogan', 'Soluciones tecnológicas en fibra óptica — Con la mejor velocidad!'),
  ('whatsapp_contacto', '71537257 - 77766262'),
  ('banco_nombre', 'BancoSol'),
  ('banco_cuenta', 'Cuenta N° 507736-000-001 — Jaime Antonio Arriaza Prieto'),
  ('qr_imagen_url', ''),
  ('mensaje_recordatorio', 'Hola {nombre} (ID {codigo}), reciba un cordial saludo, le escribimos de {empresa}. Le recordamos que el pago de Bs {precio} por el servicio de Internet vence cada dia {dia_pago} del mes, y cuenta con un maximo de 5 dias despues de su fecha de corte. Caso contrario, se procedera al corte por disposicion de Gerencia.\nSi realizo el deposito, le rogamos enviarlo por este mismo medio.\nSi gusta, le enviamos un QR para realizar el pago de manera electronica.\nAtte: {empresa}'),
  ('mensaje_al_dia', 'Hola {nombre}, gracias por tu pago. Tu servicio {plan} esta al dia. Que tengas un buen dia!'),
  ('mensaje_inactivo', 'Hola {nombre}, te contactamos de tu proveedor de internet. Notamos que tu servicio esta inactivo. Si quieres reactivarlo o conocer nuestras promociones actuales, escribenos, con gusto te ayudamos!')
on conflict (clave) do nothing;

-- ============================================================
-- Vistas (equivalentes a las fórmulas del Excel original)
-- ============================================================

-- Total pagado por cliente en el mes en curso
create or replace view v_pagos_mes_actual as
select cliente_id, coalesce(sum(monto),0) as total
from pagos
where date_trunc('month', fecha_pago) = date_trunc('month', current_date)
group by cliente_id;

-- Estado de cada cliente: "Al día" / "Vencido" (según pago del mes en curso vs. precio de su plan)
create or replace view v_clientes_estado as
select c.*,
  coalesce(pm.total,0) as pagado_mes_actual,
  case
    when coalesce(pm.total,0) >= c.precio and c.precio > 0 then 'Al día'
    else 'Vencido'
  end as estado
from clientes c
left join v_pagos_mes_actual pm on pm.cliente_id = c.id;

-- KPIs del Dashboard
create or replace view v_dashboard as
select
  (select count(*) from clientes) as total_clientes,
  (select count(*) from clientes where activo) as clientes_activos,
  (select count(*) from clientes where not activo) as clientes_inactivos,
  (select count(*) from v_clientes_estado where activo and estado = 'Al día') as clientes_al_dia,
  (select count(*) from v_clientes_estado where activo and estado = 'Vencido') as clientes_vencidos,
  (select coalesce(sum(monto),0) from pagos
     where date_trunc('month', fecha_pago) = date_trunc('month', current_date)) as cobrado_mes_actual,
  (select coalesce(sum(monto),0) from pagos) as ingreso_historico,
  (select coalesce(round(avg(monto),2),0) from pagos) as ticket_promedio;

-- Estadísticas mensuales del año en curso
create or replace view v_estadisticas_mensual as
select
  date_trunc('month', fecha_pago) as mes,
  sum(monto) as recaudado,
  count(*) as n_pagos,
  count(distinct cliente_id) as n_clientes
from pagos
where date_part('year', fecha_pago) = date_part('year', current_date)
group by 1
order by 1;

-- ============================================================
-- Seguridad (RLS): cualquier usuario autenticado puede leer/escribir.
-- Si luego quieres roles distintos (ej. solo-lectura para cobradores),
-- se ajustan estas policies.
-- ============================================================
alter table clientes enable row level security;
alter table pagos enable row level security;
alter table planes enable row level security;
alter table config enable row level security;

drop policy if exists "auth_all_clientes" on clientes;
drop policy if exists "auth_all_pagos" on pagos;
drop policy if exists "auth_all_planes" on planes;
drop policy if exists "auth_all_config" on config;

create policy "auth_all_clientes" on clientes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_pagos" on pagos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_planes" on planes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_config" on config for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
