# FIDELIZATE — Instrucciones de construccion para Cursor

Documento maestro. Construye la aplicacion **FIDELIZATE**, un sistema de tarjetas
de fidelizacion digital multi-negocio. Sigue este documento de arriba hacia abajo.
No inventes endpoints, nombres de campos ni rutas distintas a las definidas aqui.
Si algo no esta especificado, elige la opcion mas simple y dejalo anotado en un
comentario `// TODO(decision):`.

---

## 1. Que es FIDELIZATE

Reemplazo digital de la tarjeta fisica de sellos ("compra 10, el 10 es gratis").

Tres superficies en una sola app:

1. **Acceso (login)**: correo + contrasena, o "Continuar con Google".
2. **Dashboard del manager** (rol MANAGER): ve los clientes del negocio en vivo,
   metricas, y un panel para crear nuevos usuarios (cajeros) y editar la config.
3. **Caja (cajero)** (rol CASHIER): busca al cliente por RUT, ve su tarjeta de
   sellos, y con un boton registra una compra. Cada compra suma un sello en la
   base de datos local y dispara un webhook a GHL que activa el workflow de estado
   de ventas (1 a 10) y las automatizaciones configuradas en GHL.

La **base de datos local es la fuente de verdad** del conteo de sellos. GHL recibe
el evento solo para mensajeria y automatizaciones (WhatsApp, email, tags, estado).

---

## 2. Stack tecnico (obligatorio)

- **Next.js 14** (App Router) + **TypeScript** en modo estricto.
- **Tailwind CSS** + **shadcn/ui** para componentes.
- **Prisma ORM** + **PostgreSQL** (produccion). En local se puede usar la misma
  Postgres via Docker; no usar SQLite para evitar diferencias de schema.
- **Auth.js v5 (NextAuth)** con dos proveedores: Credentials (correo+contrasena)
  y Google.
- **bcrypt** (o argon2) para hash de contrasenas.
- **Zod** para validar todo input de API y Server Actions.
- **TanStack Query** opcional en el cliente; los Route Handlers son la API.
- Gestor de paquetes: **pnpm**.

No agregues Redux, GraphQL, ni librerias de estado pesadas. Manten el arbol simple.

---

## 3. Roles y permisos

```
MANAGER  -> acceso a /dashboard y /caja. Puede crear usuarios, ver todos los
            clientes, editar config del negocio.
CASHIER  -> acceso solo a /caja. Busca clientes y registra compras.
```

Middleware (`middleware.ts`) protege rutas:
- `/dashboard/**` exige sesion con `role === "MANAGER"`.
- `/caja/**` exige sesion con `role` en `["MANAGER", "CASHIER"]`.
- Sin sesion -> redirige a `/login`.

Cada usuario y cada cliente pertenece a un `Business` (multi-tenant). Toda consulta
filtra por `businessId` de la sesion. Nunca devuelvas datos de otro negocio.

---

## 4. Modelo de datos

Usa el archivo `prisma/schema.prisma` que ya esta en este repo como contrato exacto.
Resumen:

- **Business**: negocio/tenant. Guarda `rewardAt` (sellos para premio, default 10),
  branding (`logoUrl`, `primaryColor`) y las dos URLs de webhook de GHL.
- **User**: staff (MANAGER o CASHIER). `passwordHash` nullable (puede ser solo
  Google). `googleId` nullable y unico. `isActive` + `deactivatedAt` para
  habilitar/deshabilitar la cuenta sin borrarla.
- **Customer**: cliente final de fidelizacion. Unico por `(businessId, rut)`.
  Guarda `stampCount` (sellos actuales 0..rewardAt), `totalStamps` (historico),
  `ghlContactId` opcional, y `isActive` + `deactivatedAt`.
- **Sale**: cada compra registrada. Guarda `stampAfter`, `rewardTriggered`,
  `ghlSynced`, `cashierId`.

**Borrado logico (obligatorio)**: nunca se elimina fisicamente un usuario ni un
cliente. Desactivar = `isActive = false` + `deactivatedAt = now()`. La data
(sellos, compras, historico) se conserva siempre. Un usuario con `isActive = false`
no puede iniciar sesion. Un cliente desactivado no aparece en la caja por defecto
pero conserva todo su historial y puede reactivarse.

No agregues campos sensibles a respuestas de API. Nunca devuelvas `passwordHash`.

---

## 5. Logica de sellos (definicion canonica)

Al registrar una compra para un cliente con `current = customer.stampCount` y
`rewardAt = business.rewardAt`:

```
next            = current + 1
rewardTriggered = next === rewardAt          // esta compra completa la tarjeta
displayCount    = next                        // lo que se muestra en la animacion
persistedCount  = rewardTriggered ? 0 : next  // se resetea tras premiar
```

- Se guarda `Sale.stampAfter = next`, `Sale.rewardTriggered = rewardTriggered`.
- Se actualiza `Customer.stampCount = persistedCount`, `Customer.totalStamps += 1`.
- La respuesta al cliente incluye `{ displayCount, rewardTriggered, persistedCount }`.
  La UI muestra la tarjeta llena + mensaje de premio cuando `rewardTriggered`,
  y en la siguiente busqueda el cliente ya aparece con 0.

Toda esta operacion debe ser **transaccional** (`prisma.$transaction`): primero se
escribe en DB, luego se dispara el webhook a GHL. Si el webhook falla, la compra
queda registrada con `ghlSynced = false` y se devuelve exito al cajero con un aviso
de "sincronizacion pendiente". No revertir la compra por un fallo de GHL.

---

## 6. Integracion con GHL (contrato de webhook)

Cada negocio tiene `ghlPurchaseWebhookUrl` (workflow inbound trigger en GHL).
Al registrar una compra, hacer `POST` a esa URL con este body exacto:

```json
{
  "rut": "12.345.678-9",
  "name": "Juan Perez",
  "email": "juan@correo.cl",
  "phone": "+56912345678",
  "stampCount": 7,
  "rewardAt": 10,
  "rewardTriggered": false,
  "ghlContactId": "abc123"
}
```

El workflow en GHL (lo configura el usuario, no Cursor) hara:
1. Buscar/crear contacto por RUT o telefono.
2. Update custom field `loyalty_stamps = stampCount`.
3. Update campo de estado 1..10 segun `stampCount`.
4. Si `rewardTriggered === true`: enviar WhatsApp de premio + tag
   `loyalty_reward_pending`.
5. Si no: mensaje de seguimiento segun el numero de compras.

`ghlPurchaseWebhookUrl` es opcional: si esta vacio, registrar la compra solo en DB
local y marcar `ghlSynced = false` sin error (modo sin GHL para desarrollo).

No se usa la API directa de GHL ni se lee el conteo desde GHL. La busqueda por RUT
siempre es contra la DB local.

---

## 7. Rutas de la aplicacion (App Router)

```
/login                      Pagina de acceso (correo+pass + Google)
/dashboard                  Manager: metricas + tabla de clientes + crear usuario
/dashboard/settings         Manager: branding, rewardAt, URLs de webhook GHL
/caja                       Cajero: buscar por RUT + tarjeta + agregar compra
/api/auth/[...nextauth]     Auth.js (manejado por la libreria)
```

### Route Handlers (API interna, todos exigen sesion)

```
GET    /api/customers?rut=               Busca cliente ACTIVO por RUT en el negocio.
                                         200 -> { customer } | 404 -> no existe/inactivo
POST   /api/customers                    Crea cliente { rut, name, email?, phone? }.
GET    /api/customers/list?status=&query= Lista paginada (solo MANAGER).
                                         status = active | inactive | all (default all).
PATCH  /api/customers/:id/status         Activa/desactiva cliente { isActive } (MANAGER).
                                         Borrado logico: setea deactivatedAt, no elimina.
POST   /api/sales                        Registra compra { customerId }.
                                         Aplica logica de seccion 5 + webhook seccion 6.
POST   /api/users                        Crea usuario staff (solo MANAGER):
                                         { email, name, password?, role }.
GET    /api/users?status=                Lista staff (MANAGER). status = active|inactive|all.
PATCH  /api/users/:id/status             Activa/desactiva usuario { isActive } (MANAGER).
                                         Un usuario inactivo no puede iniciar sesion.
```

Valida cada body con Zod. Devuelve errores con forma `{ error: string }` y status
HTTP correcto (400, 401, 403, 404, 409, 502).

---

## 8. Pantallas (detalle de UI)

Diseno limpio y calido, estilo "tarjeta de fidelizacion premium". Usa shadcn/ui.
Mobile-first: la caja se usara en tablet o telefono.

### 8.1 /login
- Logo del negocio (o placeholder).
- Inputs: correo, contrasena. Boton "Ingresar".
- Separador "o".
- Boton "Continuar con Google" (icono Google).
- Tras login: MANAGER -> /dashboard, CASHIER -> /caja.

### 8.2 /dashboard (MANAGER)
No es tiempo real. Se carga al entrar y hay un boton "Actualizar" para refrescar.
- Barra superior con nombre del negocio, avatar, logout, link a Settings.
- Fila de KPIs: total de clientes activos, sellos entregados hoy, premios activados
  hoy, cajeros activos.
- **Tabla de clientes (cuentas)**: RUT, nombre, sellos actuales (mini barra),
  ultima compra, **estado (Activo / Desactivado)**. Filtro por estado
  (Activos | Desactivados | Todos), buscador y paginacion. Cada fila tiene accion
  para **desactivar o reactivar** (borrado logico, nunca eliminar). Al desactivar
  se conserva todo el historial; solo deja de aparecer en la caja.
- **Panel "Usuarios" (staff)**: formulario para crear cajero/manager (correo,
  nombre, rol, contrasena temporal). Lista de usuarios con su estado y accion para
  activar/desactivar la cuenta. Un usuario desactivado no puede iniciar sesion pero
  su registro y sus ventas asociadas se conservan.

### 8.3 /dashboard/settings (MANAGER)
- Branding: nombre, logo (URL o upload a /public por ahora), color primario.
- `rewardAt` (sellos para premio).
- `ghlPurchaseWebhookUrl` (input con test "Enviar ping de prueba").

### 8.4 /caja (CASHIER o MANAGER)
- Barra superior minima con logo y logout.
- Campo grande: "RUT del cliente" + boton Buscar. Es lo unico visible al entrar.
- Al buscar:
  - Si existe: muestra **tarjeta de fidelizacion** con sellos (rejilla de
    `rewardAt` posiciones, llenos en dorado), barra de progreso "X / rewardAt",
    y boton grande **"Agregar compra"** abajo.
  - Si no existe: tarjeta "Cliente nuevo" con formulario corto (nombre, telefono)
    y boton "Crear y agregar primer sello".
- Al agregar compra: animacion del nuevo sello; si `rewardTriggered`, banner de
  premio. Si el webhook quedo pendiente, toast discreto "sincronizacion pendiente".

Reutiliza el look del prototipo en `../loyalty-app/client` (tarjeta con gradiente
calido, sellos dorados, barra de progreso) pero implementado en React/Tailwind.

---

## 9. Autenticacion (Auth.js v5)

- Proveedores: `Credentials` y `Google`.
- Estrategia de sesion: JWT. Incluir en el token `userId`, `role`, `businessId`.
- Callback `signIn` para Google: si el email no existe como `User`, **rechazar**
  el acceso (no auto-registrar). El alta de usuarios la hace el MANAGER desde el
  dashboard; Google solo enlaza a un usuario ya creado con ese correo (setear
  `googleId` en el primer login exitoso).
- `Credentials.authorize`: buscar usuario por email, comparar `passwordHash` con
  bcrypt. **Rechazar si `isActive === false`** (cuenta desactivada). Aplicar
  **rate-limiting** en este endpoint (ver seccion 11). El callback de Google
  tambien debe rechazar usuarios con `isActive === false`.
- Variables: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `NEXTAUTH_URL`.

Pasos para Google OAuth (documentar en README, el usuario los hace):
1. Google Cloud Console -> APIs & Services -> Credentials -> OAuth client ID
   (Web application).
2. Authorized redirect URI local: `http://localhost:3000/api/auth/callback/google`.
3. En produccion: `https://fidelizate.<dominio>/api/auth/callback/google`.

---

## 10. Seed inicial

Crear `prisma/seed.ts` que inserte:
- Un `Business` demo ("Negocio Demo", slug `demo`, rewardAt 10).
- Un usuario MANAGER (`manager@demo.cl` / contrasena `Fidelizate2026!`).
- Un usuario CASHIER (`cajero@demo.cl` / contrasena `Caja2026!`).
- 3 clientes de ejemplo con distintos sellos (2, 5, 9).

Documentar estas credenciales en el README como "solo desarrollo".

---

## 11. Seguridad (obligatorio)

Equivalentes Node/Next de las reglas del usuario:
- Nunca hardcodear secretos. Cargar desde `process.env`; fallar al arrancar si
  falta una variable critica (helper `requireEnv`).
- Nunca loguear contrasenas, tokens, ni el body de auth.
- Hash de contrasenas con bcrypt (cost >= 12) o argon2id.
- Validar todo input con Zod antes de tocar la DB.
- Rate-limiting en `/api/auth` y en login (ej. `@upstash/ratelimit` o un limiter
  en memoria por IP para local). Maximo 5 intentos por minuto por IP.
- CORS: la app es same-origin; no exponer la API a otros origenes.
- Toda query filtra por `businessId` de la sesion (aislamiento de tenant).
- No exponer campos sensibles en los `select` de Prisma de las respuestas.
- Validar exhaustivamente el JWT de sesion (exp, role, businessId presentes).
- `.env` en `.gitignore`. Commitear solo `.env.example`.

Antes de cada deploy: `pnpm audit` y revisar dependencias.

---

## 12. Estructura de carpetas objetivo

```
FIDELIZATE/
  app/
    login/page.tsx
    dashboard/page.tsx
    dashboard/settings/page.tsx
    caja/page.tsx
    api/
      auth/[...nextauth]/route.ts
      customers/route.ts
      customers/list/route.ts
      sales/route.ts
      users/route.ts
  components/
    ui/                      (shadcn)
    LoyaltyCard.tsx
    StampGrid.tsx
    CustomerTable.tsx
    CreateUserForm.tsx
  lib/
    auth.ts                  (config Auth.js)
    db.ts                    (PrismaClient singleton)
    ghl.ts                   (cliente webhook GHL)
    validators.ts            (schemas Zod)
    env.ts                   (requireEnv)
  prisma/
    schema.prisma
    seed.ts
  middleware.ts
  .env.example
  docker-compose.yml
  Dockerfile
  README.md
```

---

## 13. Orden de construccion (fases para Cursor)

Construir y verificar fase por fase. No avanzar si la anterior no corre.

1. **Scaffold**: `pnpm create next-app` (TS, Tailwind, App Router). Instalar
   prisma, @auth/prisma-adapter, next-auth, bcrypt, zod, shadcn/ui.
2. **DB**: copiar `prisma/schema.prisma`, levantar Postgres con docker-compose,
   `prisma migrate dev`, crear `seed.ts`, ejecutar seed.
3. **Auth**: configurar Auth.js (Credentials + Google), `middleware.ts`, pagina
   `/login`. Verificar login con las credenciales del seed.
4. **Caja**: `/caja` con busqueda por RUT (`GET /api/customers`), tarjeta, alta de
   cliente nuevo, y `POST /api/sales` con la logica de la seccion 5 (sin GHL aun,
   `ghlSynced=false`).
5. **GHL**: implementar `lib/ghl.ts` y disparar el webhook en `/api/sales` segun
   seccion 6. Boton de "ping de prueba" en settings.
6. **Dashboard**: KPIs, tabla de clientes en vivo (polling), crear usuario
   (`POST /api/users`), settings.
7. **Pulido**: estados de carga, errores, toasts, responsive, dark mode opcional.
8. **Deploy**: Dockerfile + docker-compose (app + postgres), instrucciones Nginx.

Tras cada fase, correr `pnpm build` y `pnpm lint` sin errores.

---

## 14. Despliegue (local -> VPS)

**Local**:
```
cp .env.example .env        # completar valores
docker compose up -d db     # postgres
pnpm install
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev                    # http://localhost:3000
```

**VPS** (mismo VPS donde corre n8n; ya hay Nginx):
- `docker compose up -d` (app + postgres, o postgres gestionada aparte).
- Nginx reverse proxy: subdominio `fidelizate.<dominio>` -> contenedor app:3000.
- Certificado TLS (certbot / el que ya use el VPS).
- Variables de entorno de produccion en el `.env` del servidor (no commitear).
- Actualizar la redirect URI de Google OAuth al dominio de produccion.

---

## 15. Definicion de "terminado"

- Manager entra con Google y con correo/contrasena, ve dashboard con clientes en
  vivo y crea cajeros.
- Cajero entra, busca un RUT, ve la tarjeta, agrega una compra; el sello sube en
  la DB y, si hay webhook configurado, GHL recibe el evento.
- Al completar `rewardAt` sellos se dispara `rewardTriggered` y la tarjeta se
  resetea.
- Aislamiento por negocio verificado (un usuario no ve datos de otro `businessId`).
- `pnpm build` y `pnpm lint` limpios. Seed reproducible.
