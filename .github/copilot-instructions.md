# Invoice — GitHub Copilot Instructions

## Project overview
Multi-tenant SaaS invoice management for Swiss SMEs. One admin user per tenant.
Swiss QR-bill support. Bilingual UI (EN/FR).

## Current phase
**Phase 8 — Server-side pagination + search + SQLite dev mode** (complete)

### Completed
- **Phase 1** — Backend skeleton (FastAPI + SQLAlchemy + Alembic + JWT auth) + frontend skeleton (Angular 22 zoneless + Tailwind v4 + DaisyUI)
- **Phase 2** — `ArticleStore` with `withEntities` / `withComputed` / `withHooks`; `IArticleService` DI token + `MockArticleService`
- **Phase 3** — `ArticleFormComponent` with `linkedSignal` fields, `computed()` validation, create/edit modal
- **Phase 4** — Article CRUD backend endpoints; `HttpArticleService` (`HttpClient` + `firstValueFrom`); `environment.useMock` wiring
- **Phase 5** — Customer CRUD (backend + store + form + CSV export); same DI token pattern
- **Phase 6** — Invoice CRUD + status workflow (`draft → issued → paid → cancelled`); Swiss QR-bill PDF (`fpdf2` + `qrcode[pil]`)
- **Phase 7** — Dashboard KPIs (DaisyUI `stats`); `I18nService` EN/FR with `computed(T)` reactive translations; all components i18n; store vitest specs
- **Phase 8** — Server-side pagination + search on all list endpoints (`PagedResponse[T]`); customer combobox in invoice form; `IDashboardService` token; SQLite dev mode (`make backend-dev-sqlite`); drop `currency` field (Swiss SME = CHF only)

## Repo structure
```
invoice/
├── backend/   Python 3.14 + uv + FastAPI
└── frontend/  Angular 22 + Tailwind v4 + DaisyUI
```

## Commands — `make help` for full list

| Command | Description |
|---|---|
| `make up` | Start all services (PostgreSQL + backend + frontend) |
| `make up-db` | Start PostgreSQL only |
| `make down` | Stop all services |
| `make backend-dev` | Backend dev server with hot reload (requires PostgreSQL) |
| `make backend-dev-sqlite` | Backend dev server with SQLite (no Docker needed) |
| `make backend-init-db-sqlite` | Create SQLite dev DB tables |
| `make backend-fixtures-sqlite` | Load demo fixtures into SQLite dev DB |
| `make backend-migrate` | Apply DB migrations (PostgreSQL) |
| `make backend-migration MSG="..."` | Generate new migration |
| `make backend-check` | Lint + typecheck + tests |
| `make frontend-dev` | Frontend with real backend (localhost:8000) |
| `make frontend-mock` | Frontend with mock services (no backend needed) |
| `make frontend-test` | Frontend tests (vitest) |
| `make dev` | Start DB + backend + frontend together |
| `make dev-mock` | Frontend only, all services mocked |
| `make check` | Run all checks (backend + frontend) |

### Frontend environments
- `src/environments/environment.ts` — production/dev (`useMock: false`)
- `src/environments/environment.mock.ts` — mock mode (`useMock: true`)

## Architecture decisions
- **Tenant onboarding**: no self-service signup — tenants are created via `/auth/register` endpoint or `make backend-fixtures-sqlite`; the UI only exposes login
- **Multi-tenant**: every table has `tenant_id`; auth guard in `backend/app/api/deps.py`
- **Invoice entity**: single entity, statuses `draft → issued → paid → cancelled`; always CHF (no currency field)
- **InvoiceLines are immutable** once `status = issued`
- **VAT**: `default_vat_rate` on TenantProfile (nullable = not VAT-registered), overridable per article
- **IBAN** required on TenantProfile for Swiss QR-bill
- **Mock services**: `IXxxService` token injected in Angular; swap via `environment.useMock`
- **Pagination**: all list endpoints return `PagedResponse[T]`; stores use `withState` + `withMethods` with inner `load()` (not `withEntities`)
- **SQLite dev mode**: `backend/.env.sqlite` sets `DATABASE_URL=sqlite+aiosqlite:///./dev.db`; `PRAGMA foreign_keys=ON` applied automatically; tables created via `make backend-init-db-sqlite`

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
