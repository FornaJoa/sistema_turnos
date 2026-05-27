# Sistema Turnos SaaS

Plataforma multi-local para gestión de turnos en peluquerías, barberías y centros de estética.

## Stack

- **Frontend/API:** Next.js 15 (App Router)
- **DB:** PostgreSQL + Drizzle ORM
- **Cache/Rate limit:** Redis
- **Email:** Resend (modo dev log si no hay API key)
- **WhatsApp:** Meta Cloud API (fase 2, fallback a email)

## Inicio rápido

### Base de datos (Neon — gratis)

1. Creá un proyecto en [neon.tech](https://neon.tech) o ejecutá `npx neonctl@latest init`
2. Copiá la connection string a `.env` como `DATABASE_URL`
3. Aplicá schema y datos demo:

```bash
npm install
cp .env.example .env   # pegá tu DATABASE_URL de Neon
npm run db:push
npm run db:seed
npm run dev
```

**Redis / cache** (free): [Upstash](https://upstash.com). En el dashboard copiá `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` a `.env`.

**Performance tip:** en Neon usá la URL con `-pooler` (ej. `ep-xxx-pooler.sa-east-1.aws.neon.tech`) para menos latencia en serverless.

### Alternativa local (Docker)

```bash
docker compose up -d
# DATABASE_URL=postgresql://turnos:turnos_dev@localhost:5432/sistema_turnos
npm run db:push
npm run db:seed
npm run dev
```

> **Monorepo:** las variables van en `.env` en la raíz **y** se copian a `apps/web/.env.local` (Next.js solo lee env desde su carpeta).

Abrí `http://localhost:3000`.

### Demo

- Sitio público: `/barberia-demo`
- Login: `owner@demo.com` / `password123`
- También: `admin@demo.com`, `reception@demo.com`
- Barberos: `juan@demo.com`, `maria@demo.com` → panel `/barberia-demo/barbero`

## Estructura

```
apps/web/          Next.js (público + paneles + API)
packages/db/       Schema Drizzle + seed
packages/api/      Lógica de dominio (turnos, disponibilidad, notificaciones)
```

## Roles

| Rol | Panel |
|-----|-------|
| Cliente | `/[tenant]` reserva pública |
| Recepción | `/[tenant]/reception` |
| Admin | `/[tenant]/admin` |
| Profesional | `/[tenant]/barbero` |
| Dueño | `/[tenant]/owner` + `/owner/theme` |
| Plataforma | `/platform` |

## Anti doble-reserva

1. Hold temporal (5 min)
2. Transacción con verificación de solapamiento
3. Constraint único en holds
4. Rate limiting por IP en reservas

## Cron recordatorios

```bash
curl -H "Authorization: Bearer dev-cron" http://localhost:3000/api/cron/reminders
```

## Deploy en Cloudflare

Guía completa: **[docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md)**

```bash
npm install
npm run cf:preview   # probar en local (puerto 8787)
npm run cf:deploy    # publicar a Workers
```

Requisitos en producción: Neon (pooler), Upstash Redis REST, secretos en Wrangler/Cloudflare Dashboard.

## WhatsApp (Meta)

Configurá en `.env`:

```
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

Activá por tenant en el editor de tema (`whatsappEnabled`).
