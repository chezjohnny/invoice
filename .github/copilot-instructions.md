# Invoice — GitHub Copilot Instructions

## Project overview
Multi-tenant SaaS invoice management for Swiss SMEs. One admin user per tenant.
Swiss QR-bill support. Bilingual UI (EN/FR).

## Features
What exists today; the architecture decisions below explain the rules.
- **Invoices**: `draft → issued → paid → cancelled`, payment method (cash, TWINT, bank transfer) and date, discount, offered (free) article lines, internal notes (never printed); PDF invoice, receipt once paid, payment reminders; Swiss QR-bill (SIX v2.3) and optional TWINT block
- **Customers** (persons or companies), **articles** (stock, VAT override, yearly/quarterly sales, inventory mode), **stock withdrawals**; CSV exports
- **Dashboard**: KPIs, overdue invoices with reminders, recent invoices
- **Settings**: company profile (address, phone, IBAN, TWINT, VAT, payment and reminder terms)
- **UI**: EN/FR, night mode, URL-synced list state (back button, permalinks), new-version detection; every form is a page of its own
- Day-to-day usage: `docs/workflows.md`

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
| `make backend-fixtures-generate` | Regenerate `fixtures/demo.json` (dates count back from today) |
| `make backend-create-tenant NAME=… SUBDOMAIN=… EMAIL=…` | Create a tenant and its admin (`-prod` on the VPS) |
| `make backend-set-password EMAIL=… [ARGS=--sign-out]` | Change a password, optionally ending every session (`-prod` on the VPS) |
| `make backend-shell` | IPython shell with the app and a DB session |
| `make backend-test` | Backend tests only |
| `make backend-migrate` | Apply DB migrations to `backend/dev.db` |
| `make backend-migration MSG="..."` | Generate new migration |
| `make backend-check` | Lint + format check + typecheck (app and tests) + `alembic check` + tests + `pip-audit` (known vulnerabilities, needs network) |
| `make backend-fmt` | Format the backend and apply safe lint fixes |
| `make frontend-dev` | Frontend with real backend (localhost:8000) |
| `make frontend-mock` | Frontend with mock services (no backend needed; any credentials sign in) |
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
- **Tenant onboarding**: no signup over the API — tenants are created from the CLI (`make backend-create-tenant`, `-prod` on the VPS; empty profile, completed on `/settings`) or `make backend-fixtures` (complete demo profile); the UI only exposes login. Passwords change from the CLI too (`make backend-set-password`, `ARGS=--sign-out` to end every open session). Both go through `app/services/tenants.py`
- **JWT**: access and refresh tokens carry a `type` claim, checked on use: a refresh token never opens the API, an access token is never traded for new tokens. They also carry the user's `token_version` (`ver`, 0 when absent); a token of another version is refused, so raising it signs the user out everywhere
- **Hardening**: nginx caps `/api/auth/login` at 10/min per client IP (burst 5) (real IP from Traefik's `X-Forwarded-For`, private peers only), not `/refresh`; a login takes as long for an unknown email (dummy bcrypt check); passwords ≥ 9 characters; `INVOICE_API_DOCS=false` in production hides `/docs`, `/redoc` and `/openapi.json`; CSV exports prefix formula-like cells (`= + - @`, tab, CR) with `'`
- **Multi-tenant**: customers, articles, invoices, stock withdrawals, profiles and users carry `tenant_id` (invoice lines and reminders through their invoice); every query filters by it, `get_owned()` in `app/api/crud.py` for single rows; auth guard in `backend/app/api/deps.py`
- **Customer names**: `last_name` is required and holds a company's name; `first_name` is optional (none for a company). A contact person goes in `address_line2` ("Par Mme …").
- **Invoice entity**: single entity, statuses `draft → issued → paid → cancelled`; always CHF (no currency field)
- **InvoiceLines are immutable** once `status = issued`; they sort by `position`, the order of the list sent on save (in the editor, a line is dragged by its handle, `@angular/cdk` drag and drop, or moved by the arrow keys on it, together with the offered lines of its article right below it)
- **Stock withdrawals** (`stock_withdrawals`: tasting, promotion / gift, loss, other) record articles leaving the stock unbilled — a resource of their own, never an invoice, so they touch neither invoice numbers, revenue nor `sold_quantity`. Creating one takes the stock, deleting it gives the stock back (no edit: delete and re-enter); `GET /articles` reports them as `withdrawn_quantity` over the same period as the sales. An invoice line can be **offered** (`offered`: an article, price 0, no VAT, printed "(offert)"): issuing takes it from the stock with the rest, but records it as a promotion withdrawal linked to the invoice (`invoice_id`) rather than a sale (`sold_quantity` leaves it out); cancelling the invoice removes that withdrawal, which cannot be deleted on its own (409)
- **VAT**: `default_vat_rate` on TenantProfile (nullable = not VAT-registered), overridable per article; the invoice editor fills a line with the article's rate, else the default
- **Amounts**: `invoice_amounts()` (`app/services/invoices.py`, Decimal) is the one computation for the PDF, the QR-bill, TWINT and the dashboard: subtotal, discount and each rate's VAT on the discounted lines, each rounded once to the cent (half up). The frontend's `invoiceAmounts()` (`features/invoices/invoice.model.ts`, integer cents) mirrors it; change both together. Quantities ≥ 1, prices ≥ 0, rates and discounts 0-100 % are enforced by the API schemas and the forms
- **IBAN** required on TenantProfile for Swiss QR-bill; validated (CH/LI, mod-97) in `app/schemas/tenant.py` and mirrored client-side in `features/settings/iban.ts`
- **QR-bill** follows the SIX Implementation Guidelines v2.3 (`app/services/pdf.py`, slip section): structured addresses (type `S`, the only one accepted since November 2025), street and house number split from `address_line1` (`_street_and_number`); `address_line2` is printed on the invoice (a contact or c/o above the street, a PO box below) but has no place in the QR code nor on the slip, as the guidelines require; slip fonts 11/8/10 pt (receipt 11/6/8), IBAN in groups of 4, black Swiss cross, scissors on the cut lines, corner-marked field when the payer is unknown. Tests compare the QR payload with the `qrbill` library (dev dependency only)
- **TWINT**: optional `twint_phone` on TenantProfile (Swiss mobile, stored E.164, validated in `app/schemas/tenant.py` and `features/settings/phone.ts`); when set, the PDF prints a "Pay with TWINT" block (amount + invoice number as message). It is not part of `is_complete`
- **Profile completeness**: `TenantProfile.is_complete` (address + IBAN) is the single source of truth — it gates `POST /invoices/{id}/issue` (422) and drives the shell warning banner
- **`PUT /tenant/profile`** replaces the whole profile: a partial payload is rejected (422) instead of being completed with schema defaults, which would silently wipe the omitted fields
- **Invoice numbers** are `<YYMMDD><sequence>` (`2610051`), digits only and no prefix, the sequence restarting at `1` each day, unpadded; there is no stored counter — issuing takes the day's highest number + 1 (`app/services/invoice_numbers.py`). Short on purpose: the customer types it as the TWINT message. Sorting by number compares the day, then the length.
- **Mock services**: `IXxxService` token injected in Angular; swap via `environment.useMock`
- **Pagination**: all list endpoints return `PagedResponse[T]`; stores use `withState` + `withMethods` with inner `load()` (not `withEntities`)
- **Sync backend**: FastAPI routes are plain `def` (FastAPI runs them in its threadpool) on a plain SQLAlchemy `Session` over `sqlite3` (`check_same_thread=False`: a request's connection may change thread, never be shared); the CLI and the tests (`TestClient`, an in-memory database on a `StaticPool`) are sync too. The backend was async by default, not by need: no concurrent call anywhere, one session cannot run two queries at once, SQLite takes one writer at a time, and the threadpool serves the requests side by side at this scale; async only added verbosity (`await` everywhere, `(await …).json()`) and pitfalls (a blocking call such as bcrypt held up the event loop). Keep it sync: no `async def` route or dependency, no `await`.
- **SQLite only** (dev, CI and production; PostgreSQL is overkill at this scale): the default `INVOICE_DATABASE_URL` is `backend/dev.db`, shared by `make dev` and the Docker dev stack; its schema comes from Alembic (`make backend-migrate`), never `create_all`, so dev matches production; `PRAGMA foreign_keys=ON`, WAL journal, `synchronous=NORMAL` and a 5 s `busy_timeout` applied on every connection (`app/core/database.py`)

## Production

- `docker-compose.yml` is the **production** stack (SQLite, Angular build served
  by nginx, Traefik labels); `docker-compose.dev.yml` is the dev one (SQLite,
  hot reload). The Docker targets of the Makefile (`up`, `down`, `logs*`) pass
  `-f docker-compose.dev.yml`; the `-prod` targets, run on the VPS, use the
  default (production) file.
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
- State: `@ngrx/signals` Signal Store with `withState<XState>` + `withMethods`, on **Observables, no `async`/`await` in application code**: services return `Observable`s (HttpClient's as they are, the mocks' `of(...)`); store methods are `rxMethod`s — `switchMap` for loads (a newer request cancels the one running), `exhaustMap` for a save (a double click is ignored), `concatMap` for list changes, `mergeMap` for independent ones (downloads, stock counts) — errors through `tapResponse` (`@ngrx/operators`; the error interceptor already shows a toast); list stores build on `loadPage` / `mutateThenLoad` / `pagedListMethods` (`shared/paged-list.ts`). A page that chains on a store (saved, then leave) takes an `Observable` from it into its own `rxMethod`. A page that leaves by a navigation does it in one, as its `rxMethod` stops with it (the customer editor rewrites the history with `Location.replaceState` to land on the new invoice above the new customer's page). The one exception: Signal Forms' submission actions are `async` functions by contract (they only emit or call an `rxMethod`). The token refresh is shared by the requests failing together (`shareReplay` in `core/interceptors/auth.interceptor.ts`); the new-version check reads `index.html` through `fromFetch`, past the interceptors
- Forms: Signal Forms (`@angular/forms/signals`): one `linkedSignal` model per form (reset when its input changes), `form(model, schema)` with i18n messages as functions, `[formField]` bindings (no `min`/`max`/`maxlength`/`value` attributes: validators instead), number fields typed `number | null`, a new array item built as a fresh object, never a spread of another item (Signal Forms keys items by a symbol stored on them, which a spread copies: both items would share their fields), prices and percents typed in an `appDecimal` text field (`shared/decimal-input.directive.ts`: comma or point, no spinner), integers in `type="number"`; `<form [formRoot]>` with the action in `form(…, { submission })` (it also sets `novalidate`, so our messages show instead of the browser's); every `[formField]` turns red by itself once touched and invalid (`provideFormErrorClasses()`), its message below through `<app-field-error>`; shared rules in `shared/form-errors.ts` (`requiredText()`, `percent()`, `integer()`, `countryCode()`); editors save through an `rxMethod` (`exhaustMap`) and pass `[busy]` down to `<app-form-actions>`; percents ↔ rates through `shared/percent.ts`; articles are picked by name through `<app-article-picker>` (`features/articles/`, invoice editor and stock withdrawal form); the field to type in first carries `appAutofocus` (`shared/autofocus.directive.ts`, mouse or trackpad only), lists set `autofocus` on their `<app-search-input>`
- Reactivity: derived state through `computed()` / `linkedSignal()`, a component's own async data through `rxResource()`; `effect()` only for side effects outside the signal graph (URL sync, loading the profile at sign-in), never to `.set()` another signal
- HTTP: `HttpClient`, its Observables returned as they are
- Amounts: `LOCALE_ID` is `de-CH` (`app.config.ts`) whatever the UI language, so the currency and number pipes write `CHF 1’250.50` as the PDF does; dates follow the UI language through `shared/dates.ts`
- Styling: Tailwind v4 + DaisyUI classes directly in templates
- `core/` app-wide services (auth and its guard, interceptors, DI tokens, i18n, notifications, theme, version), `features/` lazy-loaded routes, `shared/` reusable components and helpers

### Angular skill
- `.claude/skills/angular-developer/` is Angular's official agent skill (github.com/angular/skills, copied at 2698acd): reference guides on signals, forms, DI, routing, accessibility, testing, loaded on demand
- It is general guidance: the conventions above win where they differ (stores, mocks and tests as described here)
- Update it by copying `angular-developer/` from a fresh clone of github.com/angular/skills over `.claude/skills/angular-developer/`

## Code quality
- No dead code, no TODOs, YAGNI
- Comments only for non-obvious WHY
- All identifiers and comments in English
- CI (`.github/workflows/ci.yml`) runs the same checks as `make check`: keep them aligned. Dependabot (`.github/dependabot.yml`) proposes monthly grouped updates; Angular and NgRx majors, and TypeScript majors and minors, go through `ng update`; Docker base images are bumped by hand (Node's major as in `.nvmrc`, nginx stable)
