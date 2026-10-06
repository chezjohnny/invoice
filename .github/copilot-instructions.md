# Invoice — GitHub Copilot Instructions

## Project overview
Multi-tenant SaaS invoice management for Swiss SMEs. One admin user per tenant.
Swiss QR-bill support. Bilingual UI (EN/FR).

## Features
What exists today; the architecture decisions below explain the rules.
- **Invoices**: `draft → issued → paid → cancelled`, payment method (cash, TWINT, bank transfer) and date, discount, notes; PDF invoice, receipt once paid, payment reminders; Swiss QR-bill (SIX v2.3) and optional TWINT block
- **Customers** (persons or companies), **articles** (stock, VAT override, yearly/quarterly sales, inventory mode), **stock withdrawals**; CSV exports
- **Dashboard**: KPIs, overdue invoices with reminders, recent invoices
- **Settings**: company profile (address, IBAN, TWINT, VAT, payment and reminder terms)
- **UI**: EN/FR, night mode, URL-synced list state (back button, permalinks), new-version detection; every form is a page of its own
- Day-to-day usage: `docs/workflows.md` (French)

## Repo structure
```
invoice/
├── backend/   Python 3.14 + uv + FastAPI
└── frontend/  Angular 22 + Tailwind v4 + DaisyUI
```

## Commands — `make help` for full list

| Command | Description |
|---|---|
| `make up` | Start backend + frontend in Docker (SQLite, hot reload) |
| `make down` | Stop the Docker stack |
| `make backend-dev` | Backend dev server with hot reload (applies migrations first) |
| `make backend-fixtures` | Load demo fixtures (`ARGS=--reset` to reload) |
| `make backend-migrate` | Apply DB migrations to `backend/dev.db` |
| `make backend-migration MSG="..."` | Generate new migration |
| `make backend-check` | Lint + format check + typecheck (app and tests) + `alembic check` + tests + `pip-audit` (known vulnerabilities, needs network) |
| `make backend-fmt` | Format the backend and apply safe lint fixes |
| `make frontend-dev` | Frontend with real backend (localhost:8000) |
| `make frontend-mock` | Frontend with mock services (no backend needed) |
| `make frontend-test` | Frontend tests (`ng test`: Vitest on AOT-compiled code, so components with signal inputs are testable) |
| `make dev` | Start backend + frontend locally (no Docker) |
| `make dev-mock` | Frontend only, all services mocked |
| `make frontend-lint` | ESLint + angular-eslint (templates and accessibility included) |
| `make frontend-check` | Lint + tests + production build + `npm audit` |
| `make check` | Run all checks (backend + frontend) |

### Frontend environments
- `src/environments/environment.ts` — production/dev (`useMock: false`)
- `src/environments/environment.mock.ts` — mock mode (`useMock: true`)

## Architecture decisions
- **Tenant onboarding**: no signup over the API — tenants are created from the CLI (`make backend-create-tenant`, `-prod` on the VPS) or `make backend-fixtures`, with an empty profile completed on `/settings`; the UI only exposes login. Passwords change from the CLI too (`make backend-set-password`, `ARGS=--sign-out` to end every open session). Both go through `app/services/tenants.py`
- **JWT**: access and refresh tokens carry a `type` claim, checked on use: a refresh token never opens the API, an access token is never traded for new tokens. They also carry the user's `token_version` (`ver`, 0 when absent); a token of another version is refused, so raising it signs the user out everywhere
- **Hardening**: nginx caps `/api/auth/login` at 10/min per client IP (real IP from Traefik's `X-Forwarded-For`, private peers only), not `/refresh`; a login takes as long for an unknown email (dummy bcrypt check); passwords ≥ 9 characters; `INVOICE_API_DOCS=false` in production hides `/docs` and `/openapi.json`; CSV exports prefix formula-like cells (`= + - @`) with `'`
- **Multi-tenant**: every table has `tenant_id`; auth guard in `backend/app/api/deps.py`
- **Customer names**: `last_name` is required and holds a company's name; `first_name` is optional (none for a company). A contact person goes in `address_line2` ("Par Mme …").
- **Invoice entity**: single entity, statuses `draft → issued → paid → cancelled`; always CHF (no currency field)
- **InvoiceLines are immutable** once `status = issued`
- **Stock withdrawals** (`stock_withdrawals`: tasting, promotion / gift, loss, other) record articles leaving the stock unbilled — a resource of their own, never an invoice, so they touch neither invoice numbers, revenue nor `sold_quantity`. Creating one takes the stock, deleting it gives the stock back (no edit: delete and re-enter); `GET /articles` reports them as `withdrawn_quantity` over the same period as the sales
- **VAT**: `default_vat_rate` on TenantProfile (nullable = not VAT-registered), overridable per article
- **IBAN** required on TenantProfile for Swiss QR-bill; validated (CH/LI, mod-97) in `app/schemas/tenant.py` and mirrored client-side in `features/settings/iban.ts`
- **QR-bill** follows the SIX Implementation Guidelines v2.3 (`app/services/pdf.py`, slip section): structured addresses (type `S`, the only one accepted since November 2025), street and house number split from `address_line1` (`_street_and_number`); `address_line2` is printed on the invoice (a contact or c/o above the street, a PO box below) but has no place in the QR code nor on the slip, as the guidelines require; slip fonts 11/8/10 pt (receipt 11/6/8), IBAN in groups of 4, black Swiss cross, scissors on the cut lines, corner-marked field when the payer is unknown. Tests compare the QR payload with the `qrbill` library (dev dependency only)
- **TWINT**: optional `twint_phone` on TenantProfile (Swiss mobile, stored E.164, validated in `app/schemas/tenant.py` and `features/settings/twint.ts`); when set, the PDF prints a "Pay with TWINT" block (amount + invoice number as message). It is not part of `is_complete`
- **Profile completeness**: `TenantProfile.is_complete` (address + IBAN) is the single source of truth — it gates `POST /invoices/{id}/issue` (422) and drives the shell warning banner
- **`PUT /tenant/profile`** replaces the whole profile: a partial payload is rejected (422) instead of being completed with schema defaults, which would silently wipe the omitted fields
- **Invoice numbers** are `<YYMMDD><sequence>` (`2610051`), digits only and no prefix, the sequence restarting at `1` each day, unpadded; there is no stored counter — issuing takes the day's highest number + 1 (`app/services/invoice_numbers.py`). Short on purpose: the customer types it as the TWINT message. Sorting by number compares the day, then the length.
- **Mock services**: `IXxxService` token injected in Angular; swap via `environment.useMock`
- **Pagination**: all list endpoints return `PagedResponse[T]`; stores use `withState` + `withMethods` with inner `load()` (not `withEntities`)
- **SQLite only** (dev, CI and production; PostgreSQL is overkill at this scale): the default `INVOICE_DATABASE_URL` is `backend/dev.db`, shared by `make dev` and the Docker dev stack; its schema comes from Alembic (`make backend-migrate`), never `create_all`, so dev matches production; `PRAGMA foreign_keys=ON`, WAL journal, `synchronous=NORMAL` and a 5 s `busy_timeout` applied on every connection (`app/core/database.py`)

## Production

- `docker-compose.yml` is the **production** stack (SQLite, Angular build served
  by nginx, Traefik labels); `docker-compose.dev.yml` is the dev one (SQLite,
  hot reload). The Makefile targets all pass `-f docker-compose.dev.yml`.
- The deployment hook on the VPS runs a bare `docker compose up -d --build`, so
  the production file must stay the default one.
- Production is SQLite: keep migrations dialect-portable. Never write raw
  PostgreSQL SQL in a migration — `sa.func.now()`, not `sa.text('now()')`, which
  SQLite rejects at insert time. `alembic/env.py` enables `render_as_batch` on
  SQLite so that column-altering migrations work.
- The `api` container applies `alembic upgrade head` on start (entrypoint), so a
  push that adds a migration needs no manual step.
- Frontend `Dockerfile` is multi-stage: `dev` (ng serve) → `build` → `prod`
  (nginx, the default target). Keep the `/api/` proxy in `frontend/nginx.conf`
  aligned with `proxy.conf.mjs`: both strip the prefix.
- Persistent state lives on the host in `INVOICE_DATA_DIR`, never in the repo
  directory — the hook's `git checkout -f` would wipe it.

## Backend conventions
- Python 3.14, all code in English
- Models inherit `UUIDBase` from `app/models/base.py`
- Pydantic v2 schemas in `app/schemas/`; `PagedResponse[T]` in `app/schemas/common.py`
- FastAPI routers in `app/api/routes/`, one file per resource
- Business logic in `app/services/`
- Ruff + mypy enforced

## Frontend conventions
- Angular 22 standalone components, zoneless change detection
- State: `@ngrx/signals` Signal Store with `withState<XState>` + `withMethods`; inner `load()` function pattern; setter methods return `Promise<void>`
- Forms: `linkedSignal` fields + `computed()` validation
- HTTP: `HttpClient` + `firstValueFrom`
- Styling: Tailwind v4 + DaisyUI classes directly in templates
- `core/` auth/guards/interceptors/tokens, `features/` lazy-loaded routes, `shared/` reusable components

## Code quality
- No dead code, no TODOs, YAGNI
- Comments only for non-obvious WHY
- All identifiers and comments in English
- CI (`.github/workflows/ci.yml`) runs the same checks as `make check`: keep them aligned. Dependabot (`.github/dependabot.yml`) proposes monthly grouped updates; Angular, NgRx and TypeScript majors go through `ng update`, Docker base images are bumped by hand (`.nvmrc`, nginx stable)
