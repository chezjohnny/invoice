from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api import crud
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tenant import TenantProfile, User
from app.schemas.tenant import TenantProfileResponse, TenantProfileUpdate

router = APIRouter(prefix="/tenant", tags=["tenant"])


@router.get("/profile", response_model=TenantProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantProfile:
    return await crud.get_profile(db, current_user.tenant_id)


@router.put("/profile", response_model=TenantProfileResponse)
async def update_profile(
    body: TenantProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantProfile:
    profile = await crud.get_profile(db, current_user.tenant_id, joinedload(TenantProfile.tenant))

    for field, value in body.model_dump().items():
        setattr(profile, field, value)
    # Keep the tenant label aligned with the legal name printed on invoices.
    profile.tenant.name = profile.company_name

    await db.commit()
    # Not redundant despite expire_on_commit=False: re-reading applies the
    # column scale (Numeric(5, 4)), so this response matches a later GET.
    await db.refresh(profile)
    return profile
