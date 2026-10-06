# Invoice

Multi-tenant SaaS invoice management for Swiss SMEs, with Swiss QR-bill support
and a bilingual (EN/FR) interface. One admin user per tenant.

## Features

- **Invoicing workflow** — `draft → issued → paid → cancelled`; invoice lines are
  immutable once issued; payment method (cash, TWINT, bank transfer) and date;
  payment reminders; a paid invoice prints as a receipt.
- **Swiss QR-bill** — PDF with the payment part and receipt of the SIX
  Implementation Guidelines v2.3 (structured addresses), optional TWINT block.
- **Articles & customers** — full CRUD, customers as persons or companies,
  per-article VAT override, stock tracking on issue/cancel, yearly and quarterly
  sales, inventory mode, stock withdrawals (tastings, gifts, losses), CSV export.
- **Dashboard** — drafts, outstanding and overdue invoices, amount paid this
  year, recent invoices.
- **Multi-tenant** — every table is scoped by `tenant_id`; JWT auth with access
  token auto-refresh.
- **Bilingual UI** — reactive EN/FR translations, night mode.
- **CHF only** — Swiss SME focus, no currency field.
- **Server-side pagination & search** on all list endpoints.

The day-to-day usage workflows (phone pre-order, counter sale, payments,
quarterly check, inventory, reminders) and how the app supports them are
described in [docs/workflows.md](docs/workflows.md) (in French).

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2 (async), Alembic, `uv` |
| Frontend | Angular 22 (zoneless, standalone), Tailwind v4, DaisyUI, `@ngrx/signals` |
| Database | SQLite (dev and production) |
| Auth | JWT (PyJWT) |

## Repository layout

```
invoice/
├── backend/                 FastAPI app, models, migrations, CLI, tests
├── frontend/                Angular app (+ nginx.conf for production)
├── docker-compose.yml       production stack (SQLite + nginx, Traefik labels)
├── docker-compose.dev.yml   development stack (SQLite + hot reload)
└── Makefile                 all dev commands — run `make help`
```

## Prerequisites

- [`uv`](https://docs.astral.sh/uv/) (backend, Python 3.14 is fetched automatically)
- Node **24.18** (see `.nvmrc`) for the frontend
- Docker (optional, only for the Docker dev stack)

## Quick start

Both options use the same SQLite file, `backend/dev.db`, whose schema is
managed by Alembic exactly as in production.

### Option A — no Docker

```bash
make backend-fixtures          # apply migrations and load demo data
make dev                       # backend + frontend
```

### Option B — Docker

```bash
make up                        # backend + frontend, hot reload
make backend-fixtures          # load demo data (from the host, same file)
```

### Frontend only, fully mocked (no backend/DB)

```bash
make dev-mock
```

The UI is then available at <http://localhost:4200> and the API at
<http://localhost:8000> (docs at `/docs`).

**Demo login:** `admin@cave.ch` / `secret123` (tenant *Cave du Lac*).

The demo data (`backend/fixtures/demo.json`) covers persons and companies,
archived records, payments, overdue invoices with reminders and stock
withdrawals. Its dates count back from the day it was generated: run
`make backend-fixtures-generate`, then `make backend-fixtures ARGS=--reset`, to
bring them up to date.

> Tenants are created from the command line, never over the API: there is no
> signup, the UI only exposes login.
>
> ```bash
> make backend-create-tenant NAME="Cave du Lac" SUBDOMAIN=cave-du-lac EMAIL=you@example.ch
> make backend-set-password EMAIL=you@example.ch
> ```
>
> Both ask for the password (twice, at least 9 characters), or read it from
> stdin when piped. A new tenant starts with an empty company profile, to
> complete on `/settings`. Add `ARGS=--sign-out` to a password change to also end
> the sessions open on every device; without it, they last until their tokens
> expire (up to 7 days).

## Configuration

Settings are read from environment variables (via `pydantic-settings`) with the
**`INVOICE_` prefix**, then from a `backend/.env` file, then defaults.

| Variable | Default | Notes |
|---|---|---|
| `INVOICE_DATABASE_URL` | `sqlite+aiosqlite:///./dev.db` | relative to `backend/`; production uses `/data/invoice.db` |
| `INVOICE_SECRET_KEY` | dev-only placeholder | **must** be overridden in production (≥ 32 bytes) |
| `INVOICE_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | |
| `INVOICE_REFRESH_TOKEN_EXPIRE_DAYS` | `7` | |
| `INVOICE_API_DOCS` | `true` | `/docs` and `/openapi.json`; `false` in production |
| `INVOICE_ROOT_PATH` | empty | `/api` in production, behind the nginx proxy |
| `INVOICE_DATA_DIR` | `./data` | docker compose only: host directory mounted on `/data` |

## Common commands

Run `make help` for the full list.

| Command | Description |
|---|---|
| `make dev` | Backend + frontend, no Docker |
| `make up` / `make down` | Start / stop the Docker dev stack |
| `make backend-dev` | Backend dev server (applies migrations first) |
| `make backend-migrate` | Apply migrations to `backend/dev.db` |
| `make backend-shell` | Interactive shell with the app and DB preloaded |
| `make backend-migration MSG="…"` | Generate a new Alembic migration |
| `make backend-fixtures [ARGS=--reset]` | Load demo fixtures |
| `make backend-create-tenant NAME=… SUBDOMAIN=… EMAIL=…` | Create a tenant and its admin |
| `make backend-set-password EMAIL=… [ARGS=--sign-out]` | Change a user's password, optionally ending every open session |
| `make backend-fmt` | Format the backend and apply safe lint fixes |
| `make backend-check` | Lint, format, typecheck, `alembic check`, tests, `pip-audit` |
| `make frontend-check` | ESLint, tests, production build, `npm audit` |
| `make check` | Both of the above |

## Deployment

Production runs at <https://app.saudan-vins.ch> on the VPS managed by the
`vps-infra` repository: Traefik terminates TLS and routes to the `web`
container, which serves the Angular build and proxies `/api` to the API.

Two containers, no published ports:

| Service | Image | Role |
|---|---|---|
| `api` | `python:3.14-slim` + uv | FastAPI via uvicorn; applies Alembic migrations on start |
| `web` | multi-stage → `nginx:1.30-alpine` | serves the Angular bundle, proxies `/api/` to `api:8000` |

The app uses **SQLite** everywhere: a single-tenant winery does not need
a database server, and a backup is one file. The database lives outside the
repository, in `INVOICE_DATA_DIR` on the host, so the deployment hook's
`git checkout -f` can never touch it.

### First install on the VPS

1. Point `app.saudan-vins.ch` at the VPS **before** the first deployment —
   Traefik asks Let's Encrypt for a certificate as soon as the container
   appears, and does not retry on its own if that first attempt fails.
2. Create the bare repository and its `post-receive` hook (see the `vps-infra`
   README, part B).
3. Create the data directory and the environment file:

   ```bash
   mkdir -p /home/johnny/data/invoice
   # /home/johnny/apps/invoice/.env, from .env.example — at minimum:
   #   INVOICE_SECRET_KEY=$(openssl rand -hex 32)
   #   INVOICE_DATA_DIR=/home/johnny/data/invoice
   ```

4. Deploy:

   ```bash
   git remote add production ssh://git@<VPS_IP>:60022/home/git/repositories/invoice.git
   git push production main
   ```

5. Create the tenant from the production checkout — there is no signup over the
   API. The command runs in the API image, on the production database, and asks
   for the password:

   ```bash
   cd /home/johnny/apps/invoice
   make backend-create-tenant-prod NAME="Saudan Vins" SUBDOMAIN=saudan EMAIL=you@example.com
   ```

   To change a password later: `make backend-set-password-prod EMAIL=you@example.com`,
   with `ARGS=--sign-out` to also end the sessions open on every device.

### Updates

```bash
git push production main
```

The hook checks the code out and runs `docker compose up -d --build`; the API
container applies any new migration on start.

### Backup

Backups are handled entirely on the VPS by `vps-infra`, not by this app: every
night, `vps-backup` takes a consistent snapshot of every `*.db` file under
`/home/johnny/data/` and sends it, encrypted, to Dropbox, with 30 days of
history and a mail only on failure. Setup, listing and **restore** procedures
live in the `vps-infra` README, section « Sauvegarde vers Dropbox ».

What this app has to respect for that to keep working:

- The database stays in `INVOICE_DATA_DIR` (`/home/johnny/data/invoice/`).
- Its file name keeps the **`.db`** extension (`/data/invoice.db` by default,
  see `INVOICE_DATABASE_URL`). Under any other name it would be copied raw like
  an ordinary file — inconsistent, since the database runs in WAL mode and
  recent writes sit in `invoice.db-wal`.

For an extra, on-the-spot copy (before a risky migration or a data change):

```bash
ssh <vps> "sqlite3 /home/johnny/data/invoice/invoice.db .dump" > invoice-$(date +%F).sql
```

Never copy `invoice.db` alone while the app runs — go through `sqlite3`
(`.dump`, `.backup` or `VACUUM INTO`), which reads the WAL too.

### Replace the production database

To put a database prepared locally in production. Everything entered in production since then is lost: compare the
invoices of both databases first.

```bash
# Locally: one consistent file, the WAL included
sqlite3 backend/prod.db ".backup /tmp/invoice-upload.db"
scp /tmp/invoice-upload.db <vps>:/tmp/

# On the VPS: keep the current database, then swap it while the API is stopped
D=/home/johnny/data/invoice
sqlite3 $D/invoice.db ".backup $D/old/invoice-before-copy-$(date +%F).db"
cd /home/johnny/apps/invoice && docker compose stop api
rm -f $D/invoice.db-wal $D/invoice.db-shm
cp /tmp/invoice-upload.db $D/invoice.db
docker compose start api       # applies any pending migration
```

The `-wal` and `-shm` files belong to the replaced database and must not be
replayed onto the new one. To roll back, swap the saved copy in the same way.

## Testing

```bash
make backend-test      # pytest
make frontend-test     # ng test (Vitest)
make check             # everything
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same checks as `make check`
on every push and pull request, and every Monday so that the audits catch newly
published vulnerabilities. Dependabot proposes grouped dependency updates each
month. The QR-bill payload is checked against the `qrbill` library in the tests.

## Interactive shell

A Flask-shell-style REPL (IPython) with a live async session and all models in
scope; top-level `await` works:

```bash
make backend-shell
```
```python
(await db.scalars(select(Customer).limit(5))).all()
await db.scalar(select(func.count(Invoice.id)))
```

## License

[GNU AGPL v3](LICENSE).
