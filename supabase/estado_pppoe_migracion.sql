-- Historial del estado de conexión PPPoE por cliente, para poder mostrar
-- "desde hace cuánto está desconectado" en la ficha del cliente.
--
-- Se guarda UNA fila por cliente (no un historial completo de eventos):
-- `conectado` es el último estado que se detectó, y `cambio_en` es la fecha
-- en la que ese estado cambió por última vez (de conectado a desconectado o
-- viceversa). `revisado_en` es solo informativo (última vez que se revisó,
-- haya cambiado o no).
--
-- Se actualiza desde dos lugares (ambos en el servidor, con la service role
-- key — nunca desde el navegador):
--   1. El botón "Ver estado de conexión" de la ficha del cliente
--      (src/app/api/estado-conexion/route.js), cada vez que alguien lo usa.
--   2. Un cron periódico (src/app/api/cron/estado-pppoe/route.js) que revisa
--      a TODOS los clientes activos, para que el historial se siga
--      actualizando aunque nadie esté mirando la ficha en ese momento.
create table if not exists estado_pppoe (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  conectado boolean not null,
  cambio_en timestamptz not null default now(),
  revisado_en timestamptz not null default now()
);

-- RLS activado sin ninguna política: esta tabla solo se lee/escribe desde
-- las rutas /api (con la service role key, que ignora RLS) — nunca
-- directamente desde el navegador con supabase-js.
alter table estado_pppoe enable row level security;
