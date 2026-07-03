# FIDELIZATE

Sistema de tarjetas de fidelizacion digital multi-negocio. Login con correo o
Google, dashboard de manager y vista de caja que registra sellos por RUT y dispara
workflows en GHL.

> **Para Cursor**: la especificacion completa de construccion esta en
> [`INSTRUCCIONES-CURSOR.md`](./INSTRUCCIONES-CURSOR.md). Construir siguiendo ese
> documento. El schema de datos canonico esta en [`prisma/schema.prisma`](./prisma/schema.prisma).

## Stack
Next.js 14 (App Router, TS) - Prisma + PostgreSQL - Auth.js v5 (Credentials +
Google) - Tailwind + shadcn/ui - Zod.

## Arranque local
```bash
cp .env.example .env          # completar AUTH_SECRET y, si aplica, Google OAuth
docker compose up -d db       # postgres local
pnpm install
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev                      # http://localhost:3000
```

## Credenciales del seed (solo desarrollo)
- Manager: `manager@demo.cl` / `Fidelizate2026!`
- Cajero:  `cajero@demo.cl`  / `Caja2026!`

## Roles
- **MANAGER**: dashboard de clientes en vivo, crea cajeros, edita config y branding.
- **CASHIER**: caja, busca por RUT y registra compras.

## GHL
Cada negocio configura `ghlPurchaseWebhookUrl`. Al registrar una compra se hace
POST con `{ rut, name, email, phone, stampCount, rewardAt, rewardTriggered,
ghlContactId }`. La fuente de verdad de los sellos es la DB local; GHL solo dispara
automatizaciones. Contrato detallado en la seccion 6 de las instrucciones.

## Despliegue
Local primero. Luego VPS (junto a n8n) con Docker + Nginx reverse proxy en
`fidelizate.<dominio>`. Ver seccion 14 de las instrucciones.
