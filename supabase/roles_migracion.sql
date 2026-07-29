-- ============================================================
-- Migración: Roles de usuario (admin / cobrador)
-- Ejecuta esto en el SQL Editor de Supabase DESPUÉS del schema.sql original.
-- ============================================================

-- Tabla de perfiles: un registro por usuario de Authentication, con su rol
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol text not null default 'cobrador' check (rol in ('admin', 'cobrador')),
  sucursal text not null default 'Todas' check (sucursal in ('El Alto', 'Tarija', 'Todas')),
  created_at timestamptz not null default now()
);

-- Si la tabla ya existía de una migración anterior, agrega la columna nueva:
alter table perfiles add column if not exists sucursal text not null default 'Todas'
  check (sucursal in ('El Alto', 'Tarija', 'Todas'));

alter table perfiles enable row level security;

-- Cualquier usuario autenticado puede ver la lista de perfiles (para mostrar nombres, etc.)
drop policy if exists "leer_perfiles" on perfiles;
create policy "leer_perfiles" on perfiles for select using (auth.role() = 'authenticated');

-- Solo un admin puede cambiar roles de otros usuarios
drop policy if exists "admin_gestiona_perfiles" on perfiles;
create policy "admin_gestiona_perfiles" on perfiles for update using (
  exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin')
);

-- Cuando se crea un usuario nuevo en Authentication, se le crea automáticamente
-- su perfil como "cobrador" (rol más restringido por defecto, por seguridad).
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger as $$
begin
  insert into public.perfiles (id, rol) values (new.id, 'cobrador')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.crear_perfil_nuevo_usuario();

-- Función helper: ¿el usuario actual es admin?
create or replace function public.es_admin()
returns boolean as $$
  select exists (
    select 1 from public.perfiles where id = auth.uid() and rol = 'admin'
  );
$$ language sql security definer stable;

-- ============================================================
-- Perfiles para los usuarios que ya existían ANTES de esta migración
-- (el trigger de arriba solo aplica a usuarios creados de ahora en adelante)
-- ============================================================
insert into public.perfiles (id, rol)
select id, 'cobrador' from auth.users
on conflict (id) do nothing;

-- IMPORTANTE: cambia el correo de abajo por el tuyo, para quedar como admin.
-- Puedes correr esta misma línea las veces que quieras con otros correos.
update perfiles set rol = 'admin'
where id = (select id from auth.users where email = 'japtomtelecom@gmail.com');

-- Opcional: si quieres que un usuario quede fijo en una sola sucursal
-- (ej. un cobrador que solo trabaja en Tarija, o solo en El Alto), corre:
-- update perfiles set sucursal = 'Tarija'
-- where id = (select id from auth.users where email = 'CORREO_DE_LA_PERSONA');
--
-- Deja sucursal = 'Todas' (el valor por defecto) para quien deba ver y
-- elegir entre ambas sucursales al entrar (normalmente tú, el Administrador).

-- ============================================================
-- Nuevas políticas de seguridad (reemplazan las políticas genéricas anteriores)
-- ============================================================

-- CLIENTES: todos ven, todos agregan y editan, solo admin borra
drop policy if exists "auth_all_clientes" on clientes;
drop policy if exists "clientes_select" on clientes;
drop policy if exists "clientes_insert" on clientes;
drop policy if exists "clientes_update" on clientes;
drop policy if exists "clientes_delete" on clientes;
create policy "clientes_select" on clientes for select using (auth.role() = 'authenticated');
create policy "clientes_insert" on clientes for insert with check (auth.role() = 'authenticated');
create policy "clientes_update" on clientes for update using (auth.role() = 'authenticated');
create policy "clientes_delete" on clientes for delete using (es_admin());

-- PAGOS: todos ven y registran, solo admin edita/borra
drop policy if exists "auth_all_pagos" on pagos;
drop policy if exists "pagos_select" on pagos;
drop policy if exists "pagos_insert" on pagos;
drop policy if exists "pagos_update" on pagos;
drop policy if exists "pagos_delete" on pagos;
create policy "pagos_select" on pagos for select using (auth.role() = 'authenticated');
create policy "pagos_insert" on pagos for insert with check (auth.role() = 'authenticated');
create policy "pagos_update" on pagos for update using (es_admin());
create policy "pagos_delete" on pagos for delete using (es_admin());

-- PLANES: todos ven el catálogo, solo admin lo gestiona
drop policy if exists "auth_all_planes" on planes;
drop policy if exists "planes_select" on planes;
drop policy if exists "planes_write" on planes;
create policy "planes_select" on planes for select using (auth.role() = 'authenticated');
create policy "planes_write" on planes for all using (es_admin()) with check (es_admin());

-- CONFIG: todos ven, solo admin edita
drop policy if exists "auth_all_config" on config;
drop policy if exists "config_select" on config;
drop policy if exists "config_write" on config;
create policy "config_select" on config for select using (auth.role() = 'authenticated');
create policy "config_write" on config for all using (es_admin()) with check (es_admin());
