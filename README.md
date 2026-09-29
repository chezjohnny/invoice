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
├── backend/                 FastAPI app, models, migrations, CLI, tests
├── frontend/                Angular app (+ nginx.conf for production)
├── docker-compose.yml       production stack (SQLite + nginx, Traefik labels)
├── docker-compose.dev.yml   development stack (PostgreSQL + hot reload)
└── Makefile                 all dev commands — run `make help`
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

## Importer un ancien projet KInvoice/Qt3

Le convertisseur produit trois fichiers JSON. Relance-le depuis l’ancien dépôt
avec le fichier `.kiv` d’origine pour conserver les identifiants clients et les
coordonnées structurées. Il retire à la génération les factures antérieures au
`01/01/2022` et les fiches clients sans facture récente correspondante :

```bash
cd ../sam-invoice
uv run python tools/convert_kiv_to_json_minimal.py /chemin/vers/archive.kiv
```

Initialise la base SQLite de développement, puis lance l’API dans un premier
terminal :

```bash
cd ../invoice
make backend-init-db-sqlite
make backend-dev-sqlite
```

Dans un autre terminal, crée le tenant (remplace les valeurs d’exemple), puis
importe les JSON générés dans `../sam-invoice/out/` :

```bash
curl -X POST http://localhost:8000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"tenant_name":"Saudan Vins","subdomain":"saudan","email":"vous@example.ch","password":"change-me"}'

make backend-import-legacy-sqlite TENANT=saudan \
  CUSTOMERS=../sam-invoice/out/customers.json \
  PRODUCTS=../sam-invoice/out/products.json \
  INVOICES=../sam-invoice/out/factures.json
```

L’import ne remplace jamais les données : le tenant doit encore être vide
(aucun client, article ou facture). Les factures historiques sont importées avec
leur numéro, leurs dates, leurs lignes et leur TVA au statut « payées ». Le champ
`paid_at` reprend une date de modification/création si l’export en fournit une ;
le `.kiv` actuel n’en contient pas, donc la date de facture sert de repli. Ce
statut payé est une règle d’import manuelle, pas une preuve de règlement bancaire.
Les noms de clients sont rapprochés à partir du nom sur la facture ; lorsqu’il
n’y a pas de correspondance unique, une fiche client distincte est créée.
Complète ensuite le profil de l’entreprise dans `/settings` avant d’émettre de
nouvelles factures. La date de paiement est éditable dans la liste Factures.

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

## Deployment

Production runs at <https://app.saudan-vins.ch> on the VPS managed by the
`vps-infra` repository: Traefik terminates TLS and routes to the `web`
container, which serves the Angular build and proxies `/api` to the API.

Two containers, no published ports:

| Service | Image | Role |
|---|---|---|
| `api` | `python:3.14-slim` + uv | FastAPI via uvicorn; applies Alembic migrations on start |
| `web` | multi-stage → `nginx:1.27-alpine` | serves the Angular bundle, proxies `/api/` to `api:8000` |

Production uses **SQLite**, not PostgreSQL: a single-tenant winery does not need
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

5. Create the tenant — there is no self-service signup:

   ```bash
   curl -fsS https://app.saudan-vins.ch/api/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"tenant_name":"Saudan Vins","subdomain":"saudan","email":"you@example.com","password":"…"}'
   ```

### Updates

```bash
git push production main
```

The hook checks the code out and runs `docker compose up -d --build`; the API
container applies any new migration on start.

### Import legacy data

Deploy the importer and `paid_at` migration first; the API container applies the
migration automatically. Back up the production SQLite database before importing.
From the local checkout, copy the three generated JSON files to the VPS:

```bash
ssh <vps> 'mkdir -p /tmp/invoice-legacy'
scp ../sam-invoice/out/customers.json ../sam-invoice/out/products.json \
  ../sam-invoice/out/factures.json <vps>:/tmp/invoice-legacy/
```

Then run the import from the production checkout on the VPS, replacing the
tenant subdomain if needed:

```bash
cd /home/johnny/apps/invoice
make backend-import-legacy-prod TENANT=saudan \
  CUSTOMERS=/tmp/invoice-legacy/customers.json \
  PRODUCTS=/tmp/invoice-legacy/products.json \
  INVOICES=/tmp/invoice-legacy/factures.json
```

The command uses the production image and persistent `/data` volume; it does
not copy the JSON into the image. The tenant must have no customers, articles,
or invoices. Imported invoices are marked paid, with `paid_at` taken from a
legacy modification date, creation date, or the invoice date fallback.

### Backup

```bash
ssh <vps> "sqlite3 /home/johnny/data/invoice/invoice.db .dump" > invoice-$(date +%F).sql
```

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
