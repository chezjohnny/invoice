# Invoice — Claude Code Instructions

@.github/copilot-instructions.md

## Dev commands

### Backend
```bash
cd backend
docker compose up -d           # start PostgreSQL
uv run alembic upgrade head    # apply migrations
uv run fastapi dev app/main.py
uv run pytest                  # tests
uv run ruff check app/         # lint
uv run ruff format app/        # format
```

### Frontend
```bash
cd frontend
npm start       # dev server (http://localhost:4200)
npm test        # vitest
npm run build   # production build
```
