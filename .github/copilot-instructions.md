# Invoice — GitHub Copilot Instructions

## Project overview
Multi-tenant SaaS invoice management for Swiss SMEs. One admin user per tenant.
Swiss QR-bill support. Bilingual UI (EN/FR).

## Current phase
**Phase 9 — Company profile editing** (complete)

### Completed
- **Phase 1** — Backend skeleton (FastAPI + SQLAlchemy + Alembic + JWT auth) + frontend skeleton (Angular 22 zoneless + Tailwind v4 + DaisyUI)
- **Phase 2** — `ArticleStore` with `withEntities` / `withComputed` / `withHooks`; `IArticleService` DI token + `MockArticleService`
- **Phase 3** — `ArticleFormComponent` with `linkedSignal` fields, `computed()` validation, create/edit modal
- **Phase 4** — Article CRUD backend endpoints; `HttpArticleService` (`HttpClient` + `firstValueFrom`); `environment.useMock` wiring
- **Phase 5** — Customer CRUD (backend + store + form + CSV export); same DI token pattern
- **Phase 6** — Invoice CRUD + status workflow (`draft → issued → paid → cancelled`); Swiss QR-bill PDF (`fpdf2` + `qrcode[pil]`)
- **Phase 7** — Dashboard KPIs (DaisyUI `stats`); `I18nService` EN/FR with `computed(T)` reactive translations; all components i18n; store vitest specs
- **Phase 8** — Server-side pagination + search on all list endpoints (`PagedResponse[T]`); customer combobox in invoice form; `IDashboardService` token; SQLite dev mode (`make backend-dev-sqlite`); drop `currency` field (Swiss SME = CHF only)
- **Phase 9** — `GET`/`PUT /tenant/profile` + `/settings` page (`ITenantService` token, root-provided `CompanyStore`); IBAN mod-97 validation; incomplete-profile banner + 422 on issue

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
| `make backend-check` | Lint + typecheck + tests |
| `make frontend-dev` | Frontend with real backend (localhost:8000) |
| `make frontend-mock` | Frontend with mock services (no backend needed) |
| `make frontend-test` | Frontend tests (vitest) |
| `make dev` | Start backend + frontend locally (no Docker) |
| `make dev-mock` | Frontend only, all services mocked |
| `make check` | Run all checks (backend + frontend) |

### Frontend environments
- `src/environments/environment.ts` — production/dev (`useMock: false`)
- `src/environments/environment.mock.ts` — mock mode (`useMock: true`)

## Architecture decisions
- **Tenant onboarding**: no self-service signup — tenants are created via `/auth/register` endpoint or `make backend-fixtures` with an empty profile, then completed on `/settings`; the UI only exposes login
- **Multi-tenant**: every table has `tenant_id`; auth guard in `backend/app/api/deps.py`
- **Invoice entity**: single entity, statuses `draft → issued → paid → cancelled`; always CHF (no currency field)
- **InvoiceLines are immutable** once `status = issued`
- **VAT**: `default_vat_rate` on TenantProfile (nullable = not VAT-registered), overridable per article
- **IBAN** required on TenantProfile for Swiss QR-bill; validated (CH/LI, mod-97) in `app/schemas/tenant.py` and mirrored client-side in `features/settings/iban.ts`
- **TWINT**: optional `twint_phone` on TenantProfile (Swiss mobile, stored E.164, validated in `app/schemas/tenant.py` and `features/settings/twint.ts`); when set, the PDF prints a "Pay with TWINT" block (amount + invoice number as message). It is not part of `is_complete`
- **Profile completeness**: `TenantProfile.is_complete` (address + IBAN) is the single source of truth — it gates `POST /invoices/{id}/issue` (422) and drives the shell warning banner
- **`PUT /tenant/profile`** replaces the whole profile: a partial payload is rejected (422) instead of being completed with schema defaults, which would silently wipe the omitted fields
- **`invoice_next_number`** is never client-writable: it is absent from `TenantProfileUpdate`, the counter moves solely on issue
- **Mock services**: `IXxxService` token injected in Angular; swap via `environment.useMock`
- **Pagination**: all list endpoints return `PagedResponse[T]`; stores use `withState` + `withMethods` with inner `load()` (not `withEntities`)
- **SQLite only** (dev, CI and production; PostgreSQL is overkill at this scale): the default `INVOICE_DATABASE_URL` is `backend/dev.db`, shared by `make dev` and the Docker dev stack; its schema comes from Alembic (`make backend-migrate`), never `create_all`, so dev matches production; `PRAGMA foreign_keys=ON` applied automatically

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
