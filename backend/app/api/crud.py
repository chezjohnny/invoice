"""Route helpers shared by the resources: a tenant's own records, its profile, archiving."""

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.interfaces import ORMOption

from app.models.tenant import TenantProfile


def get_owned[M](
    db: Session,
    model: type[M],
    record_id: uuid.UUID,
    tenant_id: uuid.UUID,
    *options: ORMOption,
) -> M:
    """The tenant's record with this id, else 404: another tenant's ids look unknown."""
    columns: Any = model
    record = db.scalar(
        select(model)
        .where(columns.id == record_id, columns.tenant_id == tenant_id)
        .options(*options)
    )
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} not found")
    return record


def get_profile(db: Session, tenant_id: uuid.UUID, *options: ORMOption) -> TenantProfile:
    """Every tenant has exactly one profile, created with it."""
    return (
        db.execute(
            select(TenantProfile).where(TenantProfile.tenant_id == tenant_id).options(*options)
        )
    ).scalar_one()


def set_archived[M](db: Session, record: M, archived: bool) -> M:
    """Archive or restore an article or a customer: hidden from the lists, never deleted."""
    columns: Any = record
    columns.is_archived = archived
    db.commit()
    db.refresh(record)
    return record
