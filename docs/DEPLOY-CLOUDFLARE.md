# Desplegar Sistema Turnos en Cloudflare Workers

Esta guía cubre: crear el repo en GitHub, configurar Neon + Upstash, y publicar la app con **OpenNext + Wrangler**.

## Requisitos previos

| Herramienta | Para qué |
|-------------|----------|
| [Git](https://git-scm.com/download/win) | Subir código a GitHub |
| [Node.js 20+](https://nodejs.org/) | Build local |
| Cuenta [Cloudflare](https://dash.cloudflare.com/) (gratis) | Hosting Workers |
| Cuenta [Neon](https://neon.tech) (gratis) | PostgreSQL |
| Cuenta [Upstash](https://upstash.com) (gratis) | Redis REST (cache + rate limit) |

---

## Parte 1 — Crear el repositorio en GitHub

El proyecto **aún no tiene git inicializado**. Desde la carpeta del proyecto:

```powershell
cd f:\work\sistema_turnos

git init
git add .
git commit -m "Initial commit: Sistema Turnos SaaS"

# Creá un repo vacío en GitHub (sin README) y conectalo:
git branch -M main
git remote add origin https://github.com/TU_USUARIO/sistema-turnos.git
git push -u origin main
```

> **No subas secretos.** `.env`, `.env.local` y `.dev.vars` ya están en `.gitignore`.

---

## Parte 2 — Base de datos y cache (una sola vez)

### Neon (PostgreSQL)

1. Creá un proyecto en [neon.tech](https://neon.tech).
2. Copiá la connection string **con pooler** (termina en `-pooler....neon.tech`).
3. En tu máquina local, pegala en `.env`:

```env
DATABASE_URL=postgresql://...@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
DB_POOL_MAX=1
```

4. Aplicá schema y datos demo:

```powershell
npm install
npm run db:push
npm run db:seed
```

### Upstash (Redis)

1. Creá una base Redis REST en [Upstash](https://console.upstash.com/).
2. Copiá `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` a `.env`.

> En Cloudflare **no uses** `REDIS_URL` con ioredis (TCP). Solo Upstash REST funciona en Workers.

### AUTH_SECRET

Generá una clave larga (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Guardala como `AUTH_SECRET` en `.env` y luego en Cloudflare (paso 4).

---

## Parte 3 — Probar el build de Cloudflare en local

```powershell
cd f:\work\sistema_turnos

# Instalar dependencias (incluye @opennextjs/cloudflare y wrangler)
npm install

# Variables para preview local (copiá desde .env)
copy apps\web\.dev.vars.example apps\web\.dev.vars
# Editá apps\web\.dev.vars con tus valores reales

# Login en Cloudflare (solo la primera vez)
npx wrangler login

# Build + preview en runtime Workers (puerto 8787)
npm run cf:preview
```

Abrí `http://localhost:8787/barberia-demo` y probá login con `owner@demo.com` / `password123`.

---

## Parte 4 — Desplegar a Cloudflare

### Opción A — Desde tu PC (rápido)

```powershell
cd f:\work\sistema_turnos

# Secretos (no van en wrangler.jsonc)
npx wrangler secret put DATABASE_URL --config apps/web/wrangler.jsonc
npx wrangler secret put AUTH_SECRET --config apps/web/wrangler.jsonc
npx wrangler secret put UPSTASH_REDIS_REST_URL --config apps/web/wrangler.jsonc
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN --config apps/web/wrangler.jsonc
npx wrangler secret put CRON_SECRET --config apps/web/wrangler.jsonc

# Opcionales (email / WhatsApp)
npx wrangler secret put RESEND_API_KEY --config apps/web/wrangler.jsonc
npx wrangler secret put RESEND_FROM_EMAIL --config apps/web/wrangler.jsonc

# URL pública de la app (actualizala después del primer deploy)
npx wrangler secret put APP_URL --config apps/web/wrangler.jsonc

npm run cf:deploy
```

Al terminar verás una URL tipo `https://sistema-turnos.TU_SUBDOMINIO.workers.dev`.

### Opción B — Deploy automático desde GitHub (recomendado)

1. Entrá a [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**.
2. Elegí **Connect to Git** → autorizá GitHub → seleccioná `sistema-turnos`.
3. Configuración del build:

| Campo | Valor |
|-------|-------|
| **Root directory** | `/` (raíz del monorepo) |
| **Build command** | `npm ci && npm run cf:build` |
| **Deploy command** | `npx wrangler deploy --config apps/web/wrangler.jsonc` |

4. En **Settings → Variables and Secrets**, agregá las mismas variables que arriba (`DATABASE_URL`, `AUTH_SECRET`, etc.) como **Secrets** (encrypted).
5. Variable pública opcional en **Vars**: `DB_POOL_MAX` = `1` (ya está en `wrangler.jsonc`).

Cada push a `main` redeploya automáticamente.

---

## Parte 5 — Dominio propio (opcional)

1. Cloudflare Dashboard → tu Worker `sistema-turnos` → **Settings → Domains & Routes**.
2. **Add Custom Domain** → ej. `turnos.tudominio.com`.
3. Actualizá el secret `APP_URL` a `https://turnos.tudominio.com`.

---

## Parte 6 — Cron de recordatorios

El endpoint es:

```
GET /api/cron/reminders
Authorization: Bearer TU_CRON_SECRET
```

Opciones:

- **cron-job.org** (gratis): programá un GET diario a  
  `https://tu-dominio.com/api/cron/reminders` con header `Authorization: Bearer ...`
- **Cloudflare Cron Triggers**: requiere configuración extra en el Worker; para empezar, un cron HTTP externo es más simple.

---

## Variables de entorno (referencia)

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | Neon con `-pooler` |
| `AUTH_SECRET` | Sí | Sesiones JWT |
| `UPSTASH_REDIS_REST_URL` | Recomendada | Cache disponibilidad |
| `UPSTASH_REDIS_REST_TOKEN` | Recomendada | Cache disponibilidad |
| `APP_URL` | Sí en prod | URL pública (cookies/redirects) |
| `CRON_SECRET` | Sí en prod | Protege `/api/cron/reminders` |
| `DB_POOL_MAX` | Auto | `1` en Workers (ya en wrangler.jsonc) |
| `RESEND_API_KEY` | No | Email real (sin key = log dev) |
| `RESEND_FROM_EMAIL` | No | Remitente |
| `WHATSAPP_*` | No | Fase 2 WhatsApp |

---

## Estructura Cloudflare en el repo

```
apps/web/
  wrangler.jsonc          # Config del Worker
  open-next.config.ts     # Adapter OpenNext
  .dev.vars.example       # Plantilla para preview local
  public/_headers         # Cache de assets estáticos
```

Scripts npm (desde la raíz):

```powershell
npm run cf:build     # Build OpenNext
npm run cf:preview   # Preview local en Workers
npm run cf:deploy    # Deploy a Cloudflare
```

---

## Solución de problemas

### `Tenant not found: favicon.ico`
Ya resuelto con rewrite en `next.config.ts` + `public/favicon.svg`.

### Build falla por tamaño del Worker (>3 MB plan free)
Pasá al plan Workers Paid ($5/mes) o reducí dependencias. OpenNext comprime con gzip; Wrangler muestra el tamaño al deployar.

### Error de conexión a DB
- Verificá que `DATABASE_URL` use el host **pooler** de Neon.
- Confirmá `DB_POOL_MAX=1`.

### Redis no funciona
Solo Upstash REST. No configures `REDIS_URL` en Cloudflare.

### Login / cookies raras
Asegurate de que `APP_URL` coincida exactamente con la URL pública (https, sin barra final).

---

## Checklist post-deploy

- [ ] `/barberia-demo` carga y permite reservar
- [ ] Login staff funciona (`owner@demo.com`)
- [ ] Panel recepción/admin responden
- [ ] Secretos configurados en Cloudflare (no en el repo)
- [ ] `APP_URL` apunta al dominio final
- [ ] Cron de recordatorios programado (opcional)
