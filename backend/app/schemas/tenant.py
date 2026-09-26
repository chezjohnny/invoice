import uuid
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

# Swiss QR-bills only accept CH/LI accounts, which are always 21 characters.
QR_BILL_IBAN_COUNTRIES = ("CH", "LI")
QR_BILL_IBAN_LENGTH = 21


def _iban_checksum_ok(iban: str) -> bool:
    """ISO 13616 mod-97 check: move the first 4 chars to the end, letters -> digits."""
    rearranged = iban[4:] + iban[:4]
    digits = "".join(str(int(c, 36)) for c in rearranged)
    return int(digits) % 97 == 1


class TenantProfileBase(BaseModel):
    company_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    address_line1: Annotated[str, StringConstraints(strip_whitespace=True)] = ""
    address_line2: str | None = None
    postal_code: Annotated[str, StringConstraints(strip_whitespace=True)] = ""
    city: Annotated[str, StringConstraints(strip_whitespace=True)] = ""
    country: Annotated[
        str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=2, max_length=2)
    ] = "CH"
    iban: str | None = None
    vat_number: str | None = None
    default_vat_rate: Decimal | None = Field(default=None, ge=0, le=1)
    invoice_prefix: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)
    ] = "INV"
    payment_terms_days: int = Field(default=30, ge=0, le=365)

    @field_validator("address_line2", "vat_number", mode="after")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        stripped = (value or "").strip()
        return stripped or None

    @field_validator("iban", mode="after")
    @classmethod
    def _validate_iban(cls, value: str | None) -> str | None:
        iban = (value or "").replace(" ", "").upper()
        if not iban:
            return None
        if (
            not (iban.isascii() and iban.isalnum())
            or not iban.startswith(QR_BILL_IBAN_COUNTRIES)
            or len(iban) != QR_BILL_IBAN_LENGTH
            or not _iban_checksum_ok(iban)
        ):
            raise ValueError("Invalid IBAN: a Swiss or Liechtenstein IBAN is required")
        return iban


class TenantProfileUpdate(TenantProfileBase):
    pass


class TenantProfileResponse(TenantProfileBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    invoice_next_number: int
    is_complete: bool

    model_config = ConfigDict(from_attributes=True)
