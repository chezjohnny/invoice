import uuid

from pydantic import BaseModel, EmailStr


class TenantRegisterRequest(BaseModel):
    tenant_name: str
    subdomain: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    tenant_id: uuid.UUID

    model_config = {"from_attributes": True}
