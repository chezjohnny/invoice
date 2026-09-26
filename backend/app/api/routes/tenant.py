import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tenant import Tenant, TenantProfile, User
from app.schemas.tenant import TenantProfileResponse, TenantProfileUpdate

router = APIRouter(prefix="/tenant", tags=["tenant"])


@router.get("/profile", response_model=TenantProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantProfile:
    return await _get_profile(current_user.tenant_id, db)


@router.put("/profile", response_model=TenantProfileResponse)
async def update_profile(
    body: TenantProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantProfile:
    profile = await _get_profile(current_user.tenant_id, db)
    for field, value in body.model_dump().items():
        setattr(profile, field, value)

    # Keep the tenant label aligned with the legal name printed on invoices.
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    ).scalar_one()
    tenant.name = profile.company_name

    await db.commit()
    await db.refresh(profile)
    return profile


async def _get_profile(tenant_id: uuid.UUID, db: AsyncSession) -> TenantProfile:
    result = await db.execute(
        select(TenantProfile).where(TenantProfile.tenant_id == tenant_id)
    )
    return result.scalar_one()
