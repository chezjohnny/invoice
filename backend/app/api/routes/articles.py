import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.article import Article
from app.models.tenant import User
from app.schemas.article import ArticleCreate, ArticleResponse, ArticleUpdate

router = APIRouter(prefix="/articles", tags=["articles"])


@router.get("", response_model=list[ArticleResponse])
async def list_articles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Article]:
    result = await db.execute(
        select(Article)
        .where(Article.tenant_id == current_user.tenant_id, Article.is_archived.is_(False))
        .order_by(Article.created_at)
    )
    return list(result.scalars().all())


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    body: ArticleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    article = Article(**body.model_dump(), tenant_id=current_user.tenant_id)
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: uuid.UUID,
    body: ArticleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    article = await _get_article(article_id, current_user.tenant_id, db)
    for field, value in body.model_dump().items():
        setattr(article, field, value)
    await db.commit()
    await db.refresh(article)
    return article


@router.patch("/{article_id}/archive", response_model=ArticleResponse)
async def archive_article(
    article_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    article = await _get_article(article_id, current_user.tenant_id, db)
    article.is_archived = True
    await db.commit()
    await db.refresh(article)
    return article


async def _get_article(
    article_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> Article:
    result = await db.execute(
        select(Article).where(Article.id == article_id, Article.tenant_id == tenant_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article
