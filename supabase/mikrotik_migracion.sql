-- ============================================================
-- Migración: Integración con MikroTik (activar/desactivar clientes
-- por PPPoE y sincronizar cambios de plan). Ejecuta esto en el SQL
-- Editor de Supabase después de las migraciones anteriores.
-- ============================================================

-- Usuario PPPoE de cada cliente (el que usan para conectarse al router)
alter table clientes add column if not exists pppoe_usuario text;

-- Nombre EXACTO del perfil PPP en tu MikroTik que corresponde a cada plan
-- (ej. el plan "Plan Hogar" del catálogo podría mapear al perfil "40M-Hogar"
-- que ya tengas creado en /ppp/profile de tu router)
alter table planes add column if not exists perfil_mikrotik text;
