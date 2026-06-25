import uuid

from pydantic import BaseModel, ConfigDict


class PhoneEntry(BaseModel):
    label: str
    number: str


class CustomerBase(BaseModel):
    first_name: str
    last_name: str
    address_line1: str = ""
    postal_code: str = ""
    city: str = ""
    country: str = "CH"
    email: str | None = None
    phones: list[PhoneEntry] = []


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    is_archived: bool

    model_config = ConfigDict(from_attributes=True)
