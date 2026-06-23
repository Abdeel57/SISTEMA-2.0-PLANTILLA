# Bismark — Página de Rifas (plantilla por cliente) 🎟️

Sitio web **PWA de rifas para UN solo organizador**. Cada cliente recibe su propia copia desplegada en Railway (backend + base de datos + frontend en **un solo servicio**). La página pública del rifero es la **página principal** del sitio; el administrador vive en **`/admin`** detrás de un inicio de sesión.

- **Mobile-first**, instalable como app (PWA), modo claro/oscuro.
- Pensada para público **mexicano**. WhatsApp como canal principal. Pagos manuales directos al organizador.
- Pie de página discreto **"Desarrollado por Bismark"** con enlace al WhatsApp de Bismark (configurable).

---

## 🗺️ Rutas del sitio

| Ruta | Qué es |
|------|--------|
| `/` | Página pública del rifero (perfil, rifas disponibles, ganadores, FAQ) |
| `/e1`, `/e2`, … | Detalle de cada rifa (apartar boletos) |
| `/verificar` | El comprador busca sus boletos por teléfono |
| `/boleto/:code` | Boleto digital con QR |
| `/validar/:code` | Validación pública de un boleto (día del sorteo) |
| `/login` | Inicio de sesión del administrador |
| `/admin` | Administrador del rifero (rifas, órdenes, pagos, diseño, reportes) |

No hay registro público, ni planes, ni landing: todo eso se eliminó. La cuenta del administrador la crea el seed automáticamente.

### Credenciales iniciales

| Usuario | Contraseña |
|---------|------------|
| `Bismark` | `admin123` |

Se pueden personalizar por cliente con las variables `ADMIN_USER` / `ADMIN_PASSWORD` (solo aplican la primera vez; el seed es idempotente y nunca pisa datos existentes).

---

## 🧱 Arquitectura

Monorepo con **npm workspaces**:

```
/apps
  /web    → Frontend PWA: React + Vite + TypeScript + Tailwind + React Router + TanStack Query + Zustand
  /api    → Backend: Node + TypeScript + Fastify + Prisma + PostgreSQL + Zod
/packages
  /shared → Tipos, enums, validaciones Zod y utilidades compartidas (contrato API)
```

- En producción la **API sirve también el frontend compilado** (`apps/web/dist`): un solo servicio, un solo dominio. La API vive bajo `/api`, los enlaces para compartir (Open Graph) bajo `/s/...` y las imágenes en `/uploads/...`.
- **Archivos** (logos, portadas, comprobantes) se guardan en **Postgres** en producción (`STORAGE_DRIVER=db`), así que sobreviven a los redeploys sin Volume. Almacenamiento configurable: `db` (default en prod), `local` (default en dev), `cloudinary` o `s3`.

---

## 🚀 Desarrollo local

```bash
# 1) Instalar dependencias
npm install

# 2) Variables de entorno
#    Windows PowerShell:
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
#    Bash/macOS/Linux:
#    cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env.local

# 3) Base local portátil + migraciones + seed (un solo comando)
npm run setup:local

# 4) Arrancar API + Web juntos
npm run dev                  # API :4000  ·  Web :5173

# Para detener la base local:
npm run db:local:stop
```

Entra a `http://localhost:5173/admin` con `Bismark` / `admin123`.

---

## ☁️ Desplegar una copia para un cliente (Railway)

Cada cliente = un proyecto de Railway con **2 cosas**: el servicio de la app y una base Postgres. **Todo** (datos, imágenes y comprobantes) vive en Postgres, así que **NO hay nada que se pierda al hacer redeploy** y **no hace falta Volume**.

1. **Crea un proyecto** en Railway y agrega el plugin **PostgreSQL**.
2. **Agrega un servicio** desde este repositorio (o un fork/copia por cliente). El `railway.json` de la raíz ya define todo:
   - Build: `npm install && npm run build` (compila shared + api + web en un solo servicio).
   - Start: migra la base → corre el seed (idempotente) → arranca la API (que también sirve el frontend).
3. **Variables del servicio** (pestaña Variables):
   - `DATABASE_URL` → **lo único indispensable.** Referencia al plugin Postgres: `${{ Postgres.DATABASE_URL }}`
   - Opcionales (recomendados por seguridad): `JWT_SECRET` y `COOKIE_SECRET` (secretos aleatorios de 32+ chars). Si no se definen, se derivan de `DATABASE_URL` de forma estable, así que el deploy funciona sin tocarlos y las sesiones no se invalidan entre redeploys.
   - Opcionales por cliente: `ADMIN_USER`, `ADMIN_PASSWORD`, `SITE_NAME` (nombre inicial de la página).
4. **Dominio**: genera el dominio público (o conecta el dominio del cliente, ej. `rifadeejemplo.com`).

Listo: la raíz del dominio muestra la página del rifero y `tudominio.com/admin` pide iniciar sesión. Cada vez que hagas redeploy, **los datos y las imágenes se conservan** (viven en Postgres).

> **Imágenes y comprobantes**: en producción se guardan automáticamente en Postgres (tabla `StoredAsset`, `STORAGE_DRIVER=db`) y se sirven en `/uploads/<key>`. Sobreviven a los deploys sin depender de un disco ni un Volume. En desarrollo local se usa disco (`apps/api/uploads/`).

> El WhatsApp del pie "Desarrollado por Bismark" se define **al compilar** con `VITE_BISMARK_WHATSAPP` (en `apps/web/.env.production` o como variable del servicio en Railway).

---

## 🔧 Scripts útiles

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | API + Web en desarrollo |
| `npm run build` | Compila shared + api + web |
| `npm run typecheck` | Verifica tipos en los 3 paquetes |
| `npm run db:migrate` | Migraciones en desarrollo |
| `npm run db:seed` | Crea el usuario administrador y el perfil (idempotente) |
| `npm run db:studio` | Prisma Studio (inspeccionar la base) |

---

## 📝 Notas

- El "usuario" de acceso se guarda en la columna `email` de la tabla `User` (en minúsculas). Para cambiar la contraseña de un cliente: actualiza `passwordHash` con un hash bcrypt nuevo (o borra el usuario y deja que el seed lo recree con `ADMIN_PASSWORD`).
- Las tablas `Plan`/`Subscription` del antiguo modelo SaaS siguen en el esquema pero **no se usan**; todos los límites y funciones están siempre activos.
- Web Push (avisos de nuevas órdenes al organizador) es opcional: genera claves con `npx web-push generate-vapid-keys` y define `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
