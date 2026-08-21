-- ============================================================
-- Migración: Apuntes del cliente (bitácora de notas internas)
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

create table if not exists notas_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  texto text not null,
  creado_por text,
  creado_en timestamptz not null default now(),
  editado_en timestamptz
);

create index if not exists idx_notas_cliente_cliente on notas_cliente (cliente_id, creado_en desc);

alter table notas_cliente enable row level security;

-- Cualquier usuario logueado (admin o cobrador) puede ver, agregar, editar y
-- borrar apuntes — son notas internas de trabajo, no hay restricción por rol.
drop policy if exists "notas_cliente_select" on notas_cliente;
drop policy if exists "notas_cliente_insert" on notas_cliente;
drop policy if exists "notas_cliente_update" on notas_cliente;
drop policy if exists "notas_cliente_delete" on notas_cliente;

create policy "notas_cliente_select" on notas_cliente for select using (auth.role() = 'authenticated');
create policy "notas_cliente_insert" on notas_cliente for insert with check (auth.role() = 'authenticated');
create policy "notas_cliente_update" on notas_cliente for update using (auth.role() = 'authenticated');
create policy "notas_cliente_delete" on notas_cliente for delete using (auth.role() = 'authenticated');
