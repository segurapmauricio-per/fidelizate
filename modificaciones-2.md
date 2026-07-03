# FIDELIZATE — Modificaciones (ronda 2) para Cursor

Mejoras sobre la base ya construida. Leer junto a `INSTRUCCIONES-CURSOR.md`,
`modificaciones.md` y `prisma/schema.prisma`. Aquí van solo los deltas. No romper lo
que ya funciona. Aplicar migraciones con Prisma. Tras cada sección: `pnpm build` y
`pnpm lint` limpios.

Contexto de roles ya existentes: `SUPER_ADMIN` (cuenta maestra), `MANAGER` (admin de
un negocio), `CASHIER` (cajero). Helper de acceso por negocio: `resolveBusinessId`
(dashboard: manager su negocio, super-admin cualquiera vía `?businessId=`) y
`resolveCajaBusinessId` (igual pero también permite cajero). Reutilizar estos helpers.

---

## Resumen de lo que se agrega

1. Restablecer contraseña de un usuario (manager o cajero) por el admin/manager.
2. Cambiar la propia contraseña (usuario logueado).
3. Editar cuenta de manager (nombre/correo/estado) desde la cuenta maestra.
4. "Olvidé mi contraseña" en el login, con recuperación por correo.
5. Verificación por correo al crear cuenta (el usuario fija su propia contraseña).
6. Editar la configuración del negocio y sus webhooks (compra y canje) ante cualquier
   cambio, tanto desde la cuenta maestra como desde el manager.

Ya hecho (NO rehacer): el bug de la caja de la cuenta maestra (no recibía
`businessId`) quedó resuelto usando `useSearchParams` en `app/caja/page.tsx`.

---

## 0. Cambios de modelo (Prisma)

Agregar a `User`:
```prisma
  emailVerified       DateTime?
  mustChangePassword  Boolean   @default(false)
```

Nueva tabla de tokens (para reset y verificación por correo):
```prisma
enum TokenType {
  PASSWORD_RESET
  EMAIL_VERIFY
}

model VerificationToken {
  id        String    @id @default(cuid())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  type      TokenType
  tokenHash String    @unique   // guardar SOLO el hash del token, nunca el token plano
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```
Agregar la relación inversa en `User`: `tokens VerificationToken[]`.

Migración: `prisma migrate dev --name auth_extras` (o `db push` en local + registrar la
migración como se viene haciendo, porque el rol de Postgres puede no tener CREATEDB).

Reglas de tokens (en todo el documento):
- El token que viaja por correo es aleatorio (>=32 bytes, base64url). En DB se guarda
  solo su hash (sha256). Al validar, se hashea el recibido y se compara.
- Expiración: 1 hora para reset, 24 horas para verificación.
- Un solo uso: al usarse, setear `usedAt`. Rechazar si `usedAt` o expirado.

---

## 1. Proveedor de correo

Usar un proveedor transaccional. Recomendado: Resend (`npm i resend`). Crear
`lib/email.ts`:
```ts
// Envia correos. En desarrollo, si no hay RESEND_API_KEY, loguear el link en consola
// en vez de enviar (no bloquear el flujo local).
export async function sendEmail(to: string, subject: string, html: string): Promise<void>
```
Variables de entorno nuevas (`.env` y `.env.example`):
```
RESEND_API_KEY=
EMAIL_FROM="FIDELIZATE <no-reply@TUDOMINIO>"
APP_URL=http://localhost:3000   # base para construir los links de los correos
```
No loguear tokens ni contraseñas. Los links de correo usan `APP_URL`.

---

## 2. Restablecer contraseña de un usuario (admin/manager → manager o cajero)

Caso: a un manager o cajero se le olvidó la contraseña y alguien con permiso la
resetea en el momento.

Endpoint: `POST /api/users/[id]/password`
- Auth: `resolveBusinessId(session, ?businessId=)` (manager sobre su negocio,
  super-admin sobre cualquiera). El usuario objetivo debe pertenecer a ese negocio.
- Body: `{ password: string (min 8) }`  (o sin body para generar una temporal aleatoria
  y devolverla una sola vez en la respuesta).
- Efecto: `passwordHash = hash(password)`, `mustChangePassword = true`. Nunca devolver
  el hash. Si se generó temporal, devolverla en texto solo en esa respuesta.

UI: en la tabla de usuarios (`components/CreateUserForm.tsx`, lista de staff) agregar
acción "Restablecer contraseña" por fila. Abre un input para la nueva contraseña
temporal (o botón "Generar"). Tras guardar, mostrar toast con la contraseña temporal
para entregársela al usuario.

`mustChangePassword`: si está en true, tras el login redirigir a una pantalla
`/cambiar-contrasena` que obliga a fijar una nueva antes de continuar (ver sección 3,
mismo endpoint de cambio propio).

---

## 3. Cambiar la propia contraseña (usuario logueado)

Endpoint: `POST /api/me/password`
- Auth: sesión válida (cualquier rol).
- Body: `{ currentPassword: string, newPassword: string (min 8) }`.
- Verifica `currentPassword` con bcrypt contra el propio hash. Si ok, actualiza y pone
  `mustChangePassword = false`.

UI:
- Página `/cambiar-contrasena` (formulario contraseña actual + nueva + repetir).
- Enlace a esta página desde el menú del usuario (manager en su dashboard; cajero en la
  caja, ícono de menú). Si `mustChangePassword`, forzar esta pantalla tras login.

---

## 4. Editar cuenta de manager (cuenta maestra)

En la vista de gestión de negocio (`/admin/business/[id]`, componente
`DashboardView` en modo admin), pestaña Usuarios: permitir al super-admin editar la
cuenta del manager (y de cajeros).

Endpoint: `PATCH /api/users/[id]`
- Auth: `resolveBusinessId` (manager su negocio, super-admin cualquiera). Usuario
  objetivo dentro de ese negocio.
- Body parcial: `{ name?, email?, role? }`. Validar email único. No permitir que un
  usuario se quite a sí mismo el último acceso de MANAGER del negocio (evitar dejar el
  negocio sin manager activo).
- Para activar/desactivar ya existe `PATCH /api/users/[id]/status`.
- Para contraseña usar el endpoint de la sección 2.

UI: botón "Editar" por fila en la lista de usuarios → formulario inline o modal
(nombre, correo, rol). Reutilizar componentes shadcn ya presentes.

---

## 5. "Olvidé mi contraseña" (login, por correo)

Flujo estándar de recuperación.

Endpoints:
- `POST /api/auth/forgot`  Body `{ email }`.
  - Buscar usuario por email. **Responder siempre 200** (no revelar si el correo existe).
  - Si existe y está activo: crear `VerificationToken` tipo `PASSWORD_RESET` (hash,
    expira en 1h), enviar correo con link `APP_URL/reset-password?token=<plano>`.
  - Rate-limit por IP y por email (ej. 3/15min).
- `POST /api/auth/reset`  Body `{ token, newPassword (min 8) }`.
  - Hashear el token recibido, buscar por `tokenHash`, validar tipo, no usado, no
    expirado. Setear nueva `passwordHash`, `mustChangePassword = false`, `usedAt = now`.

UI:
- En `/login`, link "¿Olvidaste tu contraseña?" → página `/forgot-password` (input
  email) → muestra "Si el correo existe, te enviamos un enlace".
- Página `/reset-password` (lee `token` de la URL, pide nueva contraseña x2) → llama al
  endpoint → al éxito, redirige a `/login`.

---

## 6. Verificación por correo al crear cuenta

Objetivo: al crear un usuario (manager o cajero), en vez de (o además de) entregar una
contraseña temporal, el usuario recibe un correo para **verificar su email y fijar su
propia contraseña**.

Cambios:
- Al crear usuario (`POST /api/users` y `POST /api/businesses` para el manager inicial):
  opción `sendInvite: boolean`. Si true, crear el usuario sin contraseña utilizable
  (o con una aleatoria larga no comunicada) y `emailVerified = null`, generar
  `VerificationToken` tipo `EMAIL_VERIFY` (expira 24h), enviar correo con link
  `APP_URL/activar?token=<plano>`.
- `POST /api/auth/activate`  Body `{ token, newPassword (min 8) }`.
  - Validar token (tipo EMAIL_VERIFY, no usado, no expirado). Setear `passwordHash`,
    `emailVerified = now`, `mustChangePassword = false`, `usedAt = now`.
- Página `/activar` (lee token, pide crear contraseña) → endpoint → redirige a `/login`.

Login: opcionalmente bloquear el ingreso por credenciales si `emailVerified == null`
y el usuario fue creado por invitación (mostrar "verifica tu correo / reenviar"). El
login con Google ya valida que el usuario exista; si entra por Google, marcar
`emailVerified = now`.

Nota: mantener compatible el modo actual (contraseña temporal directa) como alternativa
para cuando el admin prefiera entregarla a mano. `sendInvite` decide el camino.

---

## 7. Editar negocio y webhooks (ante cualquier cambio)

Ya existe `PATCH /api/businesses/[id]` (super-admin) que acepta `name`, `primaryColor`,
`rewardAt`, `ghlPurchaseWebhookUrl` y `ghlRedeemWebhookUrl`. Falta la UI.

UI cuenta maestra: en `/admin/business/[id]` agregar un panel "Configuración del
negocio" (o botón "Editar negocio" en el panel maestro por fila) con formulario:
nombre, color, sellos para premio, **webhook de compra**, **webhook de canje**, y botón
"Probar webhook" (ya existe `POST /api/businesses/[id]/test-webhook`). Guardar vía el
PATCH existente.

UI manager: en `/dashboard/settings` ya se edita el webhook de compra. Agregar también
el campo **webhook de canje** (`ghlRedeemWebhookUrl`) en el mismo formulario. El
endpoint del manager para settings (`PATCH /api/business`) debe aceptar
`ghlRedeemWebhookUrl` (agregarlo a `updateBusinessSchema` y al update). Mantener el
"Enviar ping de prueba" existente.

---

## 8. Checklist de seguridad (ronda 2)

- Tokens de correo: guardar solo el hash (sha256), expiración corta, un solo uso,
  invalidar tokens previos del mismo tipo al emitir uno nuevo.
- `/api/auth/forgot` responde 200 siempre (no enumerar correos). Rate-limit.
- Rate-limit también en `/api/auth/reset`, `/api/auth/activate` y en el reset por
  admin.
- Nunca loguear tokens, contraseñas ni hashes. Excluir `passwordHash` de todo
  `select` de respuesta (ya se hace).
- Verificar pertenencia al negocio en todos los endpoints de usuario
  (`resolveBusinessId` + el usuario objetivo debe tener ese `businessId`).
- Validar fuerza mínima de contraseña (>=8) en todos los flujos.
- `RESEND_API_KEY` y demás secretos solo server-side, desde `process.env`.

---

## 9. Orden sugerido de implementación

1. Modelo (sección 0) + `lib/email.ts` (sección 1).
2. Reset por admin (2) y cambio propio (3) + pantalla `/cambiar-contrasena` y
   `mustChangePassword`.
3. Editar usuario y webhooks (4 y 7) — son UI sobre endpoints casi listos.
4. Forgot/reset por correo (5).
5. Verificación por correo en creación de cuenta (6).

Tras cada paso: `pnpm build` y `pnpm lint` limpios. Probar en local con el correo en
modo consola (sin RESEND_API_KEY) antes de configurar el proveedor real.
