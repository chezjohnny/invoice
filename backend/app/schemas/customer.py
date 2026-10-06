import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


class PhoneEntry(BaseModel):
    label: str
    number: str


class CustomerBase(BaseModel):
    # A company goes in last_name, without a first name.
    first_name: str = ""
    last_name: str
    address_line1: str = ""
    address_line2: str | None = None
    postal_code: str = ""
    city: str = ""
    country: str = "CH"
    email: str | None = None
    phones: list[PhoneEntry] = []


class CustomerCreate(CustomerBase):
    last_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CustomerUpdate(CustomerCreate):
    pass


class CustomerResponse(CustomerBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    is_archived: bool

    model_config = ConfigDict(from_attributes=True)
