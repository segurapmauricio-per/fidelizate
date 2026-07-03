# FIDELIZATE — Modificaciones (ronda 1)

Mejoras sobre la base ya construida. Leer junto a `INSTRUCCIONES-CURSOR.md`
(documento base) y `prisma/schema.prisma`. Aqui solo van los **deltas**: lo que
cambia o se agrega. No rehacer lo que ya funciona (login, caja, alta de cajeros,
animacion de sello). Aplicar las migraciones de Prisma con `prisma migrate dev`.

---

## Resumen de cambios

1. **Cuentas de cliente (negocios) creadas por un super-admin**, cada una con el
   webhook de automatizacion de SU subcuenta de GHL.
2. **Quien valida si un RUT esta registrado**: lo hace FIDELIZATE, no GHL. Se le
   avisa a GHL con un flag `isNewCustomer` en el webhook.
3. **(Opcional, fase 2) Integracion via API de GHL v2** por subcuenta, con Private
   Integration Token, para upsert/lectura de contactos y guardar `ghlContactId`.

---

## 1. Super-admin: crear cuentas de cliente con su webhook de subcuenta GHL

### Contexto
FIDELIZATE es multi-negocio. El dueno de la plataforma (RIMA) da de alta a cada
**negocio cliente** (ej. una ferreteria, una clinica). Cada negocio cliente tiene
su propia subcuenta de GHL con su propia automatizacion, y por lo tanto su propio
webhook (Inbound Webhook Trigger). Ese webhook debe ingresarse al momento de crear
el negocio cliente.

### Cambios de modelo (Prisma)
Agregar a `enum Role` el valor `SUPER_ADMIN`:

```prisma
enum Role {
  SUPER_ADMIN
  MANAGER
  CASHIER
}
```

`Business.ghlPurchaseWebhookUrl` ya existe: pasa a ser el "webhook de automatizacion
de la subcuenta GHL" y es **obligatorio** al crear el negocio (validar URL con Zod).

### Roles y acceso
- `SUPER_ADMIN`: NO pertenece a un negocio operativo (o pertenece a un negocio
  "plataforma"). Puede crear negocios cliente y el MANAGER inicial de cada uno.
  Accede a una nueva seccion `/admin`.
- `MANAGER` y `CASHIER`: igual que antes, acotados a su `businessId`.

### Nueva pantalla `/admin` (solo SUPER_ADMIN)
- Lista de negocios cliente (nombre, slug, estado activo/inactivo, fecha de alta).
- Formulario **"Crear negocio cliente"**:
  - Nombre del negocio, slug.
  - Branding: color primario, logo (opcional).
  - `rewardAt` (sellos para premio, default 10).
  - **Webhook de automatizacion GHL (subcuenta)** -> `ghlPurchaseWebhookUrl`
    (requerido). Boton "Enviar ping de prueba" que hace POST del payload de ejemplo
    (ver seccion 4) para validar que la URL responde 200.
  - Datos del MANAGER inicial: correo, nombre, contrasena temporal.
  - (Opcional) campos de API GHL de la seccion 3.
- Al guardar: crea `Business` + `User` MANAGER en una transaccion.

### Endpoints nuevos (solo SUPER_ADMIN)
```
POST   /api/businesses              Crea negocio { name, slug, primaryColor?,
                                     rewardAt?, ghlPurchaseWebhookUrl,
                                     manager: { email, name, password } }.
GET    /api/businesses              Lista negocios (con conteos basicos).
PATCH  /api/businesses/:id          Edita config/branding/webhook del negocio.
PATCH  /api/businesses/:id/status   Activa/desactiva negocio (borrado logico).
POST   /api/businesses/:id/test-webhook   Dispara ping de prueba al webhook.
```

Nota: el campo de webhook tambien debe poder editarse luego desde
`/dashboard/settings` por el MANAGER del negocio (ya contemplado en el doc base),
y desde `/admin` por el super-admin.

### Seed
Agregar un usuario `SUPER_ADMIN` (`admin@fidelizate.cl` / `Admin2026!`) ademas del
MANAGER y CASHIER demo ya existentes. Documentarlo en el README como solo desarrollo.

---

## 2. Validacion de RUT registrado: la hace FIDELIZATE, no GHL

### Decision de arquitectura (importante)
La **DB local es la fuente de verdad** del registro de clientes y del conteo de
sellos. GHL NO consulta si un RUT existe. Razon tecnica: el endpoint de busqueda de
contactos de GHL (`POST /contacts/search`, v2) dedup por **email/telefono**, no por
campo personalizado como el RUT, asi que pedirle a GHL que "busque por RUT" es
fragil y lento. En su lugar:

1. El cajero busca por RUT en FIDELIZATE (`GET /api/customers?rut=`). FIDELIZATE
   responde si existe (200) o no (404). Esto ya funciona en `/caja`.
2. Si no existe, el cajero lo crea (cliente nuevo). FIDELIZATE sabe perfectamente
   si es nuevo o recurrente.
3. Al registrar la compra, FIDELIZATE **le dice a GHL** en el webhook si es nuevo,
   con el flag `isNewCustomer`. La automatizacion de GHL ramifica con eso (no
   necesita consultar nada).

### Como debe actuar la automatizacion en GHL
El Inbound Webhook Trigger recibe el payload (seccion 4). Pasos sugeridos del
workflow (los configura el usuario en GHL, no Cursor):
1. **Upsert Contact** (crear o actualizar) usando `phone` y/o `email` como llave de
   deduplicacion. Guardar el RUT en un custom field `rut`.
2. Update custom field `loyalty_stamps = stampCount` y el campo de estado 1..10.
3. Condicion sobre `isNewCustomer`:
   - `true`  -> mensaje/serie de bienvenida.
   - `false` -> mensaje de seguimiento segun `stampCount`.
4. Condicion sobre `rewardTriggered === true` -> mensaje de premio + tag
   `loyalty_reward_pending`.

Asi GHL nunca "decide" si el cliente esta registrado: solo reacciona al evento.

---

## 3. (Opcional, fase 2) Integracion via API de GHL v2 por subcuenta

Solo si se quiere que FIDELIZATE escriba/lea directamente en la subcuenta de GHL
(por ejemplo para guardar `ghlContactId` y evitar duplicados, o sincronizar datos).
El MVP funciona solo con el webhook de la seccion 2; esto es una mejora.

### Datos verificados de la API de GHL v2 (LeadConnector)
- Base URL: `https://services.leadconnectorhq.com`
- Header obligatorio: `Version: 2021-07-28`
- Auth: `Authorization: Bearer <token>`. El token puede ser el **Private Integration
  Token de la subcuenta** (Sub-Account). Cada negocio cliente genera el suyo en su
  subcuenta de GHL (Settings > Private Integrations) con scopes `contacts.write` y
  `contacts.readonly`.
- **Upsert contacto**: `POST /contacts/upsert` con body que incluye `locationId` y
  `customFields` (el RUT como TextField). Dedup por email/telefono.
- **Buscar contacto**: `POST /contacts/search` con `{ locationId, email, phone,
  skip, limit }`. (No buscar por RUT; usar email/telefono.)

### Cambios de modelo (Prisma) para esta fase
Agregar a `Business` (todos nullable, opcionales):
```prisma
  ghlLocationId String?   // id de la subcuenta (location) en GHL
  ghlApiToken   String?   // Private Integration Token de la subcuenta (cifrar en reposo)
  ghlRutFieldId String?   // id del custom field "rut" en esa subcuenta
```
`ghlApiToken` es un secreto: cifrarlo en reposo (ej. AES-GCM con clave de entorno
`FIDELIZATE_ENC_KEY`) y nunca devolverlo en respuestas de API ni loguearlo.

### Uso
`lib/ghl.ts` gana funciones opcionales: `upsertGhlContact(business, customer)` que,
si `ghlApiToken` esta presente, hace el upsert via API y guarda el `ghlContactId`
devuelto en `Customer.ghlContactId`. Si no hay token, se omite (modo webhook puro).

---

## 4. Payload del webhook (v2) — agregar campos

Extender el contrato de la seccion 6 del doc base con dos campos:

```json
{
  "rut": "18.431.296-4",
  "name": "Mauricio",
  "email": "cliente@correo.cl",
  "phone": "+56912345678",
  "stampCount": 1,
  "previousStampCount": 0,
  "stampsToReward": 9,
  "totalPurchases": 1,
  "lastPurchaseAt": "2026-06-25T19:20:00.000Z",
  "rewardAt": 10,
  "rewardTriggered": false,
  "isNewCustomer": true,
  "loyaltyStage": "NUEVO",
  "ghlContactId": "abc123"
}
```

Campos (todos valores absolutos, calculados por FIDELIZATE):
- `isNewCustomer`: `true` si el cliente se acaba de crear en esta misma operacion.
- `previousStampCount`: sellos antes de esta compra (para "te falta 1").
- `stampsToReward`: `rewardAt - stampCount`, para no obligar a GHL a calcular.
- `totalPurchases`: compras historicas totales del cliente (lifetime).
- `lastPurchaseAt`: fecha/hora ISO de esta compra. Es el ancla de los timers de
  recencia en GHL (15/30/60 dias). Mapear al custom field `loyalty_last_purchase`.
- `loyaltyStage`: etapa de PROGRESO calculada por FIDELIZATE. Valores:
  `NUEVO` | `EN_PROGRESO` | `CASI_PREMIO` | `PREMIO_LISTO`. Regla:
  `rewardTriggered -> PREMIO_LISTO`; `stampsToReward <= 2 -> CASI_PREMIO`;
  `totalPurchases == 1 -> NUEVO`; resto `EN_PROGRESO`.

El diseno completo de campos, etiquetas y workflows en GHL (incluido como sacar al
contacto del flujo anterior y recolocarlo) esta en `docs/ghl-automatizaciones.md`.

### Delta de modelo para soportar esto
Agregar a `Customer` un campo denormalizado para no recalcular en cada envio:
```prisma
  lastPurchaseAt DateTime?
```
Se actualiza en la misma transaccion de `/api/sales`. `totalPurchases` se obtiene de
`Customer.totalStamps` (ya existe) o de un contador dedicado si se prefiere separar
"sellos historicos" de "compras"; para el MVP, una compra = un sello, son iguales.

Mantener el resto igual. Volver a generar el ejemplo de mapping en GHL no es
necesario salvo que se quieran mapear estos dos campos nuevos (en ese caso, mandar
un nuevo ping de prueba y re-seleccionar el reference payload).

---

## 5. Orden de aplicacion (para Cursor)

1. Migracion Prisma: `SUPER_ADMIN` en el enum, `ghlPurchaseWebhookUrl` requerido al
   crear negocio. (`prisma migrate dev`.)
2. Pantalla `/admin` + endpoints `/api/businesses*` + ping de prueba.
3. Webhook payload v2 (campos absolutos: `isNewCustomer`, `previousStampCount`,
   `stampsToReward`, `totalPurchases`, `lastPurchaseAt`, `loyaltyStage`) en
   `/api/sales` y `lib/ghl.ts`. Agregar `Customer.lastPurchaseAt`. Ver el diseno de
   GHL en `docs/ghl-automatizaciones.md`.
4. Seed con super-admin.
5. (Opcional) Fase 2: campos `ghlLocationId` / `ghlApiToken` / `ghlRutFieldId`,
   cifrado del token, y `upsertGhlContact` en `lib/ghl.ts`.

Tras cada paso: `pnpm build` y `pnpm lint` limpios. No romper lo ya funcional.

---

## 6. Checklist de seguridad (adicional)

- `ghlApiToken` cifrado en reposo, excluido de todo `select` de respuesta y de logs.
- Endpoints `/api/businesses*` y `/admin` exigen `role === "SUPER_ADMIN"`.
- El ping de prueba al webhook NO debe exponer datos reales de clientes: usar el
  payload de ejemplo de la seccion 4.
- Validar la URL del webhook (formato y https) antes de guardarla.

---

## 7. Lista de pendientes (estado)

Hecho:
- [x] Telefono obligatorio al crear cliente (validador + caja).
- [x] `Customer.lastPurchaseAt` + migracion.
- [x] Webhook payload v2 (`previousStampCount`, `stampsToReward`, `totalPurchases`,
      `lastPurchaseAt`, `isNewCustomer`, `loyaltyStage`). Verificado contra GHL real.
- [x] **DB migrada a Supabase** (Postgres gestionado, ref sdakaobxnddpmnrxemdt).
- [x] **Supabase Storage para logos** (bucket `branding` publico). `lib/supabase.ts`
      + `/api/business/logo` suben a Storage y devuelven URL publica. Verificado.
- [x] **Perfil maestro (SUPER_ADMIN)**: rol nuevo, pantalla `/admin`, endpoints
      `/api/businesses` (GET/POST) y `/api/businesses/[id]` (PATCH editar, /status,
      /test-webhook). Crea negocio cliente + manager inicial con su webhook GHL.
      Negocio "platform" como hogar del super-admin (businessId no-nulo). Borrado
      logico de negocios (isActive/deactivatedAt). Verificado end-to-end (login,
      crear negocio, ping webhook, toggle, scoping del manager, RBAC 403).

Pendiente:
- [ ] Implementar los workflows en GHL (ver `docs/ghl-automatizaciones.md`).
- [ ] (Fase 2 opcional) Integracion API GHL v2 por subcuenta (seccion 3).
- [ ] Elegir subdominio del VPS al momento del deploy.

---

## 8. PENDIENTE — Migrar la base de datos a Supabase (para Cursor)

Objetivo: dejar de usar la Postgres local y pasar a **Supabase** (Postgres
gestionado) como base de datos de FIDELIZATE, y usar **Supabase Storage** para los
archivos subidos (logos de negocio en `/api/business/logo`, que hoy van a
`public/uploads/`).

### 8.1 Base de datos (Supabase Postgres)
1. Crear un proyecto en Supabase y obtener las dos cadenas de conexion del panel
   (Project Settings > Database):
   - **Pooled** (PgBouncer, puerto 6543, `?pgbouncer=true`): para la app en runtime
     (Next.js / serverless). Va en `DATABASE_URL`.
   - **Direct** (puerto 5432): para migraciones de Prisma. Va en `DIRECT_URL`.
2. En `prisma/schema.prisma`, en el datasource agregar `directUrl`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")   // pooled (runtime)
     directUrl = env("DIRECT_URL")     // direct (migraciones)
   }
   ```
3. `.env` / `.env.example`: agregar `DIRECT_URL` y apuntar ambas a Supabase.
4. Como el rol de Supabase SI puede crear bases, `prisma migrate deploy`
   (produccion) y `prisma migrate dev` (local contra Supabase) funcionan normal.
   Aplicar las migraciones existentes (incluida `20260626000000_add_last_purchase_at`).
5. Migrar los datos actuales si se quieren conservar: `pg_dump` de la Postgres local
   y `psql`/restore hacia Supabase (o re-seed si son datos de prueba). Para las
   pruebas actuales basta con re-seed (`prisma db seed`).

Nota: mantener el `Version`/SSL que Supabase exige (`sslmode=require` suele venir en
la cadena). No commitear las cadenas reales; solo `.env.example` con placeholders.

### 8.2 Archivos (Supabase Storage)
Reemplazar el guardado local de logos por Supabase Storage:
1. Crear un bucket (ej. `branding`) publico de solo lectura.
2. Usar `@supabase/supabase-js` con la **service role key** SOLO en el servidor
   (nunca en el cliente) para subir el archivo y obtener la URL publica.
3. Guardar esa URL publica en `Business.logoUrl`.
4. Variables nuevas: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_STORAGE_BUCKET`. La service role key es secreta: server-only, fuera de
   logs y de respuestas.
5. Quitar la dependencia de `public/uploads/` (y su regla en `.gitignore`) una vez
   migrado.

Verificar con `pnpm build` y una subida de logo de prueba que la URL publica
resuelve. No romper el resto del flujo.
