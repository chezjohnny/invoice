import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.routes import articles, auth, customers, dashboard, invoices, stock_withdrawals, tenant
from app.core.config import settings

logger = logging.getLogger("app")

app = FastAPI(
    title="Invoice API",
    version="0.1.0",
    docs_url="/docs" if settings.api_docs else None,
    redoc_url="/redoc" if settings.api_docs else None,
    openapi_url="/openapi.json" if settings.api_docs else None,
    root_path=settings.root_path,
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    logger.error("Database integrity error on %s %s", request.method, request.url.path)
    logger.exception(exc)
    return JSONResponse(
        status_code=409,
        content={"detail": "Request violates a data constraint"},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(customers.router)
app.include_router(invoices.router)
app.include_router(stock_withdrawals.router)
app.include_router(dashboard.router)
app.include_router(tenant.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
