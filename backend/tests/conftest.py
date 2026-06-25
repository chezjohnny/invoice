import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app



@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    await client.post("/auth/register", json={
        "tenant_name": "Cave Test",
        "subdomain": "cave-test",
        "email": "cave@test.ch",
        "password": "secret123",
    })
    resp = await client.post("/auth/login", json={
        "email": "cave@test.ch",
        "password": "secret123",
    })
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
async def customer_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    resp = await client.post("/customers", json={
        "first_name": "Jean", "last_name": "Dupont",
        "address_line1": "Rue de la Gare 1", "postal_code": "1110",
        "city": "Morges", "country": "CH", "email": "jean@test.ch", "phones": [],
    }, headers=auth_headers)
    return str(resp.json()["id"])
