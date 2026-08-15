-- ============================================================
-- Migración: Integración con la OLT V-Sol (ver potencia óptica,
-- reiniciar la ONT y activar/desactivar la ONU). Ejecuta esto en el
-- SQL Editor de Supabase después de las migraciones anteriores.
-- ============================================================

-- Puerto GPON de la OLT donde está conectada la ONT del cliente (1 a 4 en
-- una OLT de 4 puertos, por ejemplo). Lo ves en la interfaz web de la OLT
-- en Monitorizar > ONU, columna "Port ID" (ej. "PON1" = puerto 1).
alter table clientes add column if not exists olt_puerto_pon int;

-- ID de la ONU dentro de ese puerto (1 a 128). En la interfaz web de la
-- OLT es la columna "ONU ID" (ej. "GPON0/1:1" = puerto 1, ONU 1).
alter table clientes add column if not exists olt_onu_id int;

-- Número de serie de la ONT (opcional, solo como referencia/verificación,
-- no lo usa el CRM para conectarse). Ej. HWTC10ea4bab.
alter table clientes add column if not exists olt_sn text;
