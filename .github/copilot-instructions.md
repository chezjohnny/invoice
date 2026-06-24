# Invoice — GitHub Copilot Instructions

## Project overview
Multi-tenant SaaS invoice management for Swiss SMEs. One admin user per tenant.
Swiss QR-bill support. Bilingual UI (EN/FR).

## Current phase
**Phase 1 — Skeleton** (complete)
- Backend: FastAPI + SQLAlchemy + Alembic + JWT auth
- Frontend: Angular 22 zoneless + Tailwind v4 + DaisyUI + @ngrx/signals

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
| `make backend-dev` | Backend dev server with hot reload |
| `make backend-migrate` | Apply DB migrations |
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
- **Multi-tenant**: every table has `tenant_id`; auth guard in `backend/app/api/deps.py`
- **Invoice entity**: single entity, statuses `draft → issued → paid → cancelled`
- **InvoiceLines are immutable** once `status = issued`
- **VAT**: `default_vat_rate` on TenantProfile (nullable = not VAT-registered), overridable per article
- **IBAN** required on TenantProfile for Swiss QR-bill
- **Mock services**: `IXxxService` token injected in Angular; swap via `environment.useMock`

## Backend conventions
- Python 3.14, all code in English
- Models inherit `UUIDBase` from `app/models/base.py`
- Pydantic v2 schemas in `app/schemas/`
- FastAPI routers in `app/api/routes/`, one file per resource
- Business logic in `app/services/`
- Ruff + mypy enforced

## Frontend conventions
- Angular 22 standalone components, zoneless change detection
- State: `@ngrx/signals` Signal Store
- Forms: Angular Signal Form
- HTTP: Angular `resource()` + `HttpClient`
- Styling: Tailwind v4 + DaisyUI classes directly in templates
- `core/` auth/guards/interceptors, `features/` lazy-loaded routes, `shared/` reusable components

## Code quality
- No dead code, no TODOs, YAGNI
- Comments only for non-obvious WHY
- All identifiers and comments in English
