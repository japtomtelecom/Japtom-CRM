# CRM JapTom Telecom — Web app + PWA para Android

Esto es el CRM completo de JapTom Telecom (clientes, pagos, control mensual,
dashboard, planes, estadísticas y mensajería de WhatsApp) convertido en una
aplicación web real, con base de datos en la nube (Supabase) e instalable en
Android como app (PWA), sin pasar por Play Store.

Ya viene cargado con tus **156 clientes** y **42 pagos** actuales.

No necesitas saber programar para ponerlo en marcha — son 3 pasos, ~20 minutos,
todo gratis.

---

## Paso 1 — Crear la base de datos (Supabase, gratis)

1. Ve a https://supabase.com → **Start your project** → crea una cuenta gratis.
2. **New project**. Ponle un nombre (ej. `japtom-crm`) y una contraseña de base
   de datos (guárdala, no la necesitarás seguido). Elige la región más cercana
   (ej. São Paulo).
3. Cuando el proyecto esté listo, ve a **SQL Editor** (menú izquierdo) →
   **New query**.
4. Abre el archivo `supabase/schema.sql` de esta carpeta, copia todo su
   contenido, pégalo en el editor y dale **Run**. Esto crea todas las tablas.
5. Repite el paso 4 pero con el archivo `supabase/seed.sql` — esto carga tus
   156 clientes y 42 pagos reales.
6. Ve a **Authentication → Users → Add user** y crea el usuario con el que vas
   a entrar al sistema (tu correo y una contraseña). Puedes crear uno por cada
   persona que use el CRM.
7. Ve a **Project Settings → API**. Copia dos datos, los vas a necesitar en el
   Paso 2:
   - **Project URL**
   - **anon public key**

## Paso 2 — Publicar la web app (Vercel, gratis)

1. Sube esta carpeta a un repositorio de GitHub (puedes arrastrar los
   archivos directamente en github.com → New repository → uploads, sin usar
   la terminal).
2. Ve a https://vercel.com → crea una cuenta gratis (puedes entrar con tu
   cuenta de GitHub) → **Add New → Project** → importa el repositorio que
   acabas de subir.
3. Antes de darle a **Deploy**, abre **Environment Variables** y agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = (el Project URL del Paso 1)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (el anon public key del Paso 1)
4. Dale **Deploy**. En un par de minutos Vercel te da una URL como
   `https://japtom-crm.vercel.app` — esa es tu CRM, ya en internet, con
   dirección propia.

## Paso 3 — Instalarlo como app en Android

1. Abre la URL de Vercel en **Chrome** desde el celular.
2. Inicia sesión con el usuario que creaste en el Paso 1.
3. Toca el menú (⋮) → **Agregar a pantalla de inicio** / **Instalar app**.
4. Listo — queda como un ícono más, se abre a pantalla completa como
   cualquier app instalada.

Lo mismo funciona en una computadora con Chrome (ícono de instalar en la
barra de direcciones).

---

## ¿Qué incluye?

- **Dashboard**: total de clientes, activos/inactivos, al día/vencidos,
  cobrado del mes, ingreso histórico, ticket promedio — igual que la hoja
  DASHBOARD del Excel, pero siempre actualizado en tiempo real.
- **Clientes**: buscador, filtros (activos, vencidos, al día), ficha completa
  por cliente con historial de pagos, edición de datos, y botón para
  **enviar WhatsApp** con el mensaje correcto según su estado (recordatorio,
  agradecimiento o reactivación) — igual que en el Excel original.
- **Pagos**: registro rápido de pagos buscando al cliente por nombre.
- **Planes**: catálogo editable (Comunal, Básico, Plan Hogar, Plan Plus,
  Corporativo).
- **Estadísticas**: recaudación mensual del año en curso, con gráfico.
- **Configuración**: nombre de la empresa, WhatsApp de contacto, datos
  bancarios/QR de pago y las 3 plantillas de mensaje (editables sin tocar
  código).

## Multi-sucursal: El Alto y Tarija

El CRM ahora maneja ambas sucursales con acceso completo en las dos:

- **Al iniciar sesión**, si tu usuario está configurado para ver **ambas**
  sucursales, se te pregunta "¿A qué sucursal quieres entrar? El Alto /
  Tarija / Ver ambas juntas". Puedes cambiar esa elección en cualquier
  momento con el enlace **"Cambiar"** en la barra lateral.
- Si un usuario está asignado a **una sola sucursal** (ej. alguien que solo
  trabaja en Tarija), entra directo ahí — con **las mismas funciones que El
  Alto** (Dashboard, Clientes, Pagos, Tickets, Estadísticas), sin necesitar
  elegir nada, y sin poder ver ni tocar los datos de la otra sucursal.
- **Reportes independientes**: el Dashboard y las Estadísticas se calculan
  solo con los datos de la sucursal activa (o combinados, si elegiste "Ver
  ambas juntas").
- **Tickets de falla para cualquier sucursal**: la nueva sección **🎫
  Tickets** en el menú busca clientes de **El Alto y Tarija a la vez** (no
  está limitada a tu sucursal activa) — útil para técnicos que atienden
  ambas ciudades.

**Para asignar la sucursal de un usuario:** en el SQL Editor de Supabase:

```sql
update perfiles set sucursal = 'Tarija'
where id = (select id from auth.users where email = 'CORREO_DE_LA_PERSONA');
```

Usa `'El Alto'`, `'Tarija'`, o `'Todas'` (el valor por defecto — ve y elige
entre ambas al entrar).

### Enlace público para Tarija, sin login (opcional)

Sigue existiendo además `tu-dominio.vercel.app/tarija` — una página aparte,
sin usuario ni contraseña, pensada para que cualquiera en la sucursal cargue
un cliente nuevo o un pago sin necesitar una cuenta. Es un método alternativo
más simple al acceso completo con usuario descrito arriba; puedes usar el que
prefieras (o ambos: cuentas completas para tu personal de confianza, y el
enlace público para carga rápida ocasional).

**Para activar todo esto** (una sola vez): en el SQL Editor de Supabase,
ejecuta en este orden `schema.sql` → `roles_migracion.sql` →
`multisucursal_migracion.sql`. Tus clientes actuales quedan marcados
automáticamente como "El Alto".

## Seguridad de la sesión (si pierdes el celular o la PC)

- **Botón "Cerrar sesión" en el celular**: antes solo aparecía en
  computadora — ya está corregido, ahora aparece siempre arriba, en toda
  pantalla (celular, tablet o PC).
- **Cierre automático por inactividad**: si nadie toca la app durante **20
  minutos**, se cierra la sesión sola — así, si el dispositivo queda
  desbloqueado y sin uso, no se queda expuesto indefinidamente. (Este tiempo
  se puede ajustar: en `src/components/AppShell.js`, busca
  `useAutoLogout(20)` y cambia el número de minutos.)
- **Si de verdad pierdes o te roban el celular/PC con la sesión abierta**,
  puedes forzar el cierre de esa sesión de forma remota, sin esperar los 20
  minutos: en el **SQL Editor** de Supabase, corre:

  ```sql
  delete from auth.sessions
  where user_id = (select id from auth.users where email = 'CORREO_DE_LA_PERSONA');
  ```

  Esto invalida esa sesión — la próxima vez que la app intente renovarla
  (o al pasar unos minutos), le va a pedir iniciar sesión de nuevo. Como
  medida extra, también puedes cambiarle la contraseña a esa persona desde
  **Authentication → Users**.

## Integración con MikroTik (activar/cortar servicio y cambiar plan)

Desde la ficha de cada cliente, un **Administrador** puede:
- **⛔ Cortar servicio** / **▶️ Reactivar servicio**: activa o desactiva su
  usuario PPPoE en el MikroTik de **su sucursal** (y si está conectado en ese
  momento, lo desconecta para que el corte sea inmediato).
- **🔄 Sincronizar plan al MikroTik**: aplica al usuario PPPoE el perfil
  (velocidad) que corresponda al plan asignado en el CRM.

El sistema ya sabe distinguir **2 routers, uno por sucursal** (El Alto y
Tarija) — elige automáticamente cuál usar según la ciudad del cliente.

### Cómo activarlo (una sola vez)

**1. Base de datos**: en el SQL Editor de Supabase, ejecuta
`supabase/mikrotik_migracion.sql`.

**2. En CADA MikroTik** (el de El Alto y el de Tarija), crea un usuario
dedicado SOLO para esta integración (no uses tu usuario admin principal). Por
Winbox/Terminal, en cada router:

```
/user group add name=api-crm policy=api,read,write,test
/user add name=crm-api group=api-crm password=UNA_CONTRASEÑA_MUY_FUERTE
```

Usa una contraseña distinta en cada router. Esto limita lo que el CRM puede
hacer en tus routers — nunca les des permisos de administrador completo.

**3. Verifica que el servicio API esté habilitado** en ambos: `/ip service
print` — `api` debe estar en `enabled` (viene así por defecto). Si el router
acepta conexiones desde internet en su IP pública, considera restringir ese
puerto por firewall a lo estrictamente necesario, y usar una contraseña larga
y única — exponer la API de un router a internet siempre tiene cierto
riesgo, por más que esté protegida con usuario/contraseña.

**4. En Vercel**, ve a tu proyecto → **Settings → Environment Variables** y
agrega **una tanda por cada router** (estas NO llevan el prefijo
`NEXT_PUBLIC_`, para que nunca lleguen al navegador — solo las usa el
servidor):

```
MIKROTIK_ELALTO_HOST=ip.publica.de.el.alto
MIKROTIK_ELALTO_USER=crm-api
MIKROTIK_ELALTO_PASSWORD=la_contraseña_del_router_de_el_alto
MIKROTIK_ELALTO_PORT=8728

MIKROTIK_TARIJA_HOST=ip.publica.de.tarija
MIKROTIK_TARIJA_USER=crm-api
MIKROTIK_TARIJA_PASSWORD=la_contraseña_del_router_de_tarija
MIKROTIK_TARIJA_PORT=8728

SUPABASE_SERVICE_ROLE_KEY=(Supabase → Project Settings → API → service_role key)
```

Como Tarija todavía no tiene clientes, puedes agregar sus 4 variables
(`MIKROTIK_TARIJA_...`) más adelante, cuando instales ese router — el botón
de "Cortar/Reactivar" para clientes de El Alto va a funcionar igual mientras
tanto, solo fallaría si intentas usarlo con un cliente de Tarija antes de
configurar esas variables (con un mensaje de error claro, no un fallo
silencioso).

⚠️ La `service_role key` es distinta de la `anon key` que ya tenías — tiene
acceso total a tu base de datos saltándose los permisos normales. Es muy
sensible: solo va en Vercel (variable de servidor), nunca la compartas, nunca
la pongas en el código, nunca la uses con el prefijo `NEXT_PUBLIC_`.

**5. Completa los datos de enlace**:
- En cada **cliente** (ficha → Editar): campo **"Usuario PPPoE"**, con el
  mismo nombre que tiene configurado en `/ppp/secret` del MikroTik de su
  sucursal, y el campo **Ciudad** correcto (de eso depende a qué router se
  conecta el CRM).
- En cada **plan** (Planes): campo **"Perfil MikroTik"**, con el nombre
  exacto del perfil PPP (`/ppp/profile`). Usa el mismo nombre de perfil en
  ambos routers para que un plan funcione igual sin importar la sucursal
  (ej. que tanto El Alto como Tarija tengan un perfil llamado
  "Plan-Hogar-40M").

**6. Redeploy** en Vercel para que tome las variables de entorno nuevas.

### Recomendación antes de usarlo en producción

Prueba primero con **un solo cliente que no sea crítico** (o uno tuyo de
prueba) por cada sucursal que actives: corta y reactiva su servicio desde el
CRM y confirma en el MikroTik correspondiente que el cambio se ve reflejado
correctamente, antes de usarlo con clientes reales.

## Integración con la OLT V-Sol (potencia óptica, reiniciar ONT, activar/desactivar)

Desde la ficha de cada cliente (tarjeta **"Control OLT (V-Sol)"**), un
**Administrador** puede:
- **📶 Ver potencia óptica**: consulta en vivo el nivel de señal (Rx/Tx en
  dBm), voltaje y temperatura de la ONT del cliente, y si está en línea o
  no — igual que lo verías por consola, pero desde el CRM.
- **🔁 Reiniciar ONT**: reinicia la ONT en control remoto (tarda 1-2
  minutos en volver a conectar). Útil para resolver la mayoría de los
  problemas de conexión sin ir a la calle.
- **🔒 Desactivar ONU** / **🔓 Activar ONU**: apaga/enciende la ONU
  directamente en la OLT (independiente del corte por PPPoE del MikroTik
  — sirve como plan B, o para aislar si un problema es de la ONT o del
  router).

A diferencia del MikroTik (que tiene una API dedicada), esta OLT solo se
gestiona por consola SSH — el CRM se conecta y manda los mismos comandos
que mandarías vos a mano por PuTTY.

### Cómo activarlo (una sola vez)

**1. Base de datos**: en el SQL Editor de Supabase, ejecuta
`supabase/olt_migracion.sql`.

**2. Habilita SSH en la OLT** (si no lo está ya): en la interfaz web de la
OLT, **Sistema → SSH → Habilitar SSH**.

**3. Abre el acceso SSH desde internet hacia la OLT.** Igual que hiciste
para la web de gestión, en el router que tiene la IP pública de esa
sucursal agrega una regla de NAT dedicada para SSH (usando un puerto
externo distinto al 22 estándar, para exponer menos el equipo a escaneos
automáticos). Ejemplo en un MikroTik:

```
/ip firewall nat add chain=dstnat protocol=tcp dst-address=IP.PUBLICA dst-port=22022 action=dst-nat to-addresses=IP.INTERNA.DE.LA.OLT to-ports=22 comment="OLT-SSH-mgmt"
```

**4. En Vercel**, ve a tu proyecto → **Settings → Environment Variables** y
agrega **una tanda por cada sucursal que tenga OLT V-Sol** (sin el prefijo
`NEXT_PUBLIC_`, para que solo las use el servidor):

```
OLT_TARIJA_HOST=ip.publica.de.tarija
OLT_TARIJA_USER=admin
OLT_TARIJA_PASSWORD=la_contraseña_de_la_olt
OLT_TARIJA_PORT=22022

OLT_ELALTO_HOST=ip.publica.de.el.alto
OLT_ELALTO_USER=admin
OLT_ELALTO_PASSWORD=la_contraseña_de_la_olt
OLT_ELALTO_PORT=22022
```

Igual que con el MikroTik, si una sucursal todavía no tiene sus variables
configuradas, el botón de esa sucursal va a fallar con un mensaje de error
claro (no un fallo silencioso) hasta que las agregues.

⚠️ La contraseña de administrador de la OLT es muy sensible — controla
**toda** la red de fibra de esa sucursal. Igual que con el `service_role
key` de Supabase, nunca la compartas, nunca la pongas en el código, nunca
la uses con el prefijo `NEXT_PUBLIC_`. Si en algún momento se expone (por
ejemplo, pegada por error en un chat o mensaje), cámbiala cuanto antes
desde la interfaz web de la OLT.

**5. Completa los datos de enlace** en cada **cliente** (ficha → Editar →
tarjeta "Configuración OLT"):
- **Puerto PON**: el puerto GPON de la OLT donde está conectada su ONT
  (lo ves en la web de la OLT, en Monitorizar → ONU, columna "Port ID" —
  ej. "PON1" = puerto 1).
- **ID de ONU**: el número de ONU dentro de ese puerto (misma pantalla,
  columna "ONU ID" — ej. "GPON0/1:1" = puerto 1, ONU 1).
- **N° de serie (SN)**: opcional, solo de referencia.

**6. Redeploy** en Vercel para que tome las variables de entorno nuevas.

### Recomendación antes de usarlo en producción

Prueba primero con **un cliente que no sea crítico** (o uno tuyo de
prueba): consulta su potencia óptica y, si querés confirmar el reinicio,
avisale antes de que su internet se va a cortar un par de minutos.

### Notas técnicas (por si el firmware de tu OLT usa otra sintaxis)

Los comandos exactos que usa el CRM (definidos en `src/lib/oltSsh.js`)
fueron verificados en vivo contra una V-Sol V1600G0-B:

```
enable
configure terminal
interface gpon 0/<puerto>
show onu <id> optical_info
show onu state <id>
onu <id> reboot
onu <id> activate   /   onu <id> deactivate
end
```

Si tu modelo de OLT o versión de firmware responde distinto, avisame con
el mensaje de error (el CRM incluye la respuesta cruda de la OLT cuando
algo falla) y ajustamos los comandos en `src/lib/oltSsh.js`.

## Ticket de falla / soporte técnico

En la ficha de cada cliente hay un botón **🎫 Ticket de falla**: escribes el
motivo del reporte y descarga un **PDF** listo para imprimir o adjuntar, con
ID, nombre, teléfono, dirección y plan del cliente ya completados, más
espacio para observaciones técnicas y firmas. Elegí PDF (en vez de Word)
porque se genera al instante en el navegador sin depender de programas
externos; si prefieres que también quede en formato .docx editable, dímelo
y lo agrego.

## Roles de usuario (Administrador / Cobrador)

El sistema tiene 2 roles:

- **Administrador**: acceso total — agrega, edita y **borra** clientes y pagos;
  gestiona el catálogo de Planes y la Configuración (plantillas de WhatsApp,
  datos de empresa).
- **Cobrador**: puede ver todo, agregar clientes nuevos y **registrar pagos**,
  pero **no puede borrar** nada ni tocar Planes/Configuración (esas
  secciones se ven, pero sin botones de editar).

**Para activar los roles** (solo se hace una vez): en el **SQL Editor** de
Supabase, pega y ejecuta el contenido de `supabase/roles_migracion.sql`. Antes
de darle Run, cambia la línea que dice:

```sql
where id = (select id from auth.users where email = 'japtomtelecom@gmail.com');
```

por el correo del usuario que quieres que quede como **Administrador** (por
defecto, todo usuario nuevo se crea como Cobrador).

**Para cambiar el rol de alguien más adelante** (ej. ascender a alguien a
Administrador, o crear otro admin): en el SQL Editor, corre:

```sql
update perfiles set rol = 'admin'
where id = (select id from auth.users where email = 'CORREO_DE_LA_PERSONA');
```

(usa `'cobrador'` en vez de `'admin'` para quitarle permisos de administrador).

Esta restricción no es solo visual — está aplicada directamente en la base de
datos (Row Level Security), así que aunque alguien intente saltarse la
interfaz, la base de datos rechaza la acción si no tiene el rol correcto.

## Excel ↔ CRM de aquí en adelante

- **Exportar a Excel**: en **Configuración** y en **Clientes** hay un botón
  "Descargar Excel" que genera un .xlsx con las hojas CLIENTES, PAGOS,
  PLANES y RESUMEN, siempre con los datos reales y actuales del CRM. Úsalo
  cuando necesites un respaldo o compartir la info por fuera del sistema.
- **Excel de Drive → CRM**: si en algún momento necesitas traer cambios que
  se hicieron en el Excel de Google Drive de vuelta al CRM, pídemelo en una
  conversación con Claude (con el conector de Google Drive activado) y reviso
  el archivo y te ayudo a decidir qué importar. Esto es a pedido tuyo, no es
  automático — Claude no vigila archivos en segundo plano.
- Recomendación: usa el CRM como fuente única para el día a día (altas,
  pagos, ediciones) y el Excel solo como respaldo exportado desde aquí.

## Notas importantes

- **Login**: cada persona que use el sistema necesita un usuario creado en
  Supabase (Authentication → Users). No hay registro público — esto es
  intencional, para que solo tu equipo entre.
- **WhatsApp**: los mensajes se abren igual que en el Excel (un enlace que
  abre WhatsApp con el texto ya escrito). No hay envío automático masivo —
  eso requeriría contratar la API oficial de WhatsApp Business, que tiene
  costo. Si más adelante lo quieres, se puede agregar.
- **Estado "Al día / Vencido"**: se calcula igual que en la hoja `CONTROL
  2026` del Excel — compara lo pagado en el mes en curso contra el precio del
  plan del cliente.
- **Datos**: viven en tu propio proyecto de Supabase (Postgres real), no en
  este chat ni en Claude — son tuyos, se pueden exportar o migrar cuando
  quieras.

## Desarrollo local (opcional, solo si programas)

```bash
cp .env.local.example .env.local   # completa con tus datos de Supabase
npm install
npm run dev
```

## Siguiente paso posible: app 100% nativa de Android

Esta PWA cubre el caso de uso normal en Android (ícono, pantalla completa,
funciona sin abrir el navegador). Si más adelante necesitas una app nativa
"de verdad" (para publicarla en Play Store, con notificaciones push, etc.),
se puede reescribir esta misma lógica en React Native o Kotlin usando la
misma base de datos de Supabase — puedo generar ese código cuando lo
necesites.
