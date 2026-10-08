from app.core.config import Settings


def test_an_aiosqlite_url_from_an_older_env_takes_the_sync_driver():
    # The production .env still names the former async driver.
    url = Settings(database_url="sqlite+aiosqlite:////data/invoice.db").database_url
    assert url == "sqlite:////data/invoice.db"
    assert Settings(database_url="sqlite:///./dev.db").database_url == "sqlite:///./dev.db"
