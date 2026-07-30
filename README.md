# Invoice

Multi-tenant SaaS invoice management for Swiss SMEs, with Swiss QR-bill support
and a bilingual (EN/FR) interface. One admin user per tenant.

## Features

- **Invoicing workflow** — `draft → issued → paid → cancelled`; invoice lines are
  immutable once issued.
- **Swiss QR-bill** — QR-bill PDF generation (`fpdf2` + `qrcode`), IBAN on the
  tenant profile.
- **Articles & customers** — full CRUD, per-article VAT override, stock tracking
  on issue/cancel, CSV export.
- **Multi-tenant** — every table is scoped by `tenant_id`; JWT auth with access
  token auto-refresh.
- **Bilingual UI** — reactive EN/FR translations.
- **CHF only** — Swiss SME focus, no currency field.
- **Server-side pagination & search** on all list endpoints.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2 (async), Alembic, `uv` |
| Frontend | Angular 22 (zoneless, standalone), Tailwind v4, DaisyUI, `@ngrx/signals` |
| Database | PostgreSQL (SQLite for zero-setup local dev) |
| Auth | JWT (PyJWT) |

## Repository layout

```
invoice/
├── backend/    FastAPI app, models, migrations, CLI, tests
├── frontend/   Angular app
├── docker-compose.yml
└── Makefile    all dev commands — run `make help`
```

## Prerequisites

- [`uv`](https://docs.astral.sh/uv/) (backend, Python 3.14 is fetched automatically)
- Node **24.18** (see `.nvmrc`) for the frontend
- Docker (only for the PostgreSQL / full-stack workflow)

## Quick start

### Option A — no Docker (SQLite)

```bash
make backend-fixtures-sqlite   # create the SQLite dev DB and load demo data
make dev                       # backend (SQLite) + frontend
```

### Option B — full stack (PostgreSQL via Docker)

```bash
make up-db                     # start PostgreSQL
make backend-migrate           # apply migrations
make backend-fixtures          # load demo data
make dev                       # or: make up  (everything in Docker)
```

### Frontend only, fully mocked (no backend/DB)

```bash
make dev-mock
```

The UI is then available at <http://localhost:4200> and the API at
<http://localhost:8000> (docs at `/docs`).

**Demo login:** `admin@cave.ch` / `secret123` (tenant *Cave du Lac*).

> Tenants are created via the `/auth/register` endpoint or the demo fixtures —
> there is no self-service signup; the UI only exposes login.

## Configuration

Settings are read from environment variables (via `pydantic-settings`) with the
**`INVOICE_` prefix**, then from a `backend/.env` file, then defaults.

| Variable | Default | Notes |
|---|---|---|
| `INVOICE_DATABASE_URL` | `postgresql+asyncpg://invoice:invoice@localhost:5432/invoice` | SQLite targets set this via `backend/.env.sqlite` |
| `INVOICE_SECRET_KEY` | dev-only placeholder | **must** be overridden in production (≥ 32 bytes) |
| `INVOICE_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | |
| `INVOICE_REFRESH_TOKEN_EXPIRE_DAYS` | `7` | |

## Common commands

Run `make help` for the full list.

| Command | Description |
|---|---|
| `make dev` | Backend (SQLite) + frontend |
| `make up` / `make down` | Start / stop the full Docker stack |
| `make backend-dev` / `make backend-dev-sqlite` | Backend dev server (Postgres / SQLite) |
| `make backend-shell` / `make backend-shell-sqlite` | Interactive shell with the app and DB preloaded |
| `make backend-migration MSG="…"` | Generate a new Alembic migration |
| `make backend-fixtures [ARGS=--reset]` | Load demo fixtures |
| `make check` | All checks (backend lint + typecheck + tests, frontend build) |

## Testing

```bash
make backend-test      # pytest
make frontend-test     # vitest
make check             # everything
```

## Interactive shell

A Flask-shell-style REPL (IPython) with a live async session and all models in
scope; top-level `await` works:

```bash
make backend-shell-sqlite
```
```python
(await db.scalars(select(Customer).limit(5))).all()
await db.scalar(select(func.count(Invoice.id)))
```

## License

[GNU AGPL v3](LICENSE).
