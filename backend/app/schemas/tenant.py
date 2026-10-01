import re
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


# TWINT accounts are bound to a Swiss mobile number (07x).
_TWINT_PHONE = re.compile(r"\+417[5-9]\d{7}")
# Any E.164 number: the contact phone may be a landline or a foreign line.
_PHONE = re.compile(r"\+[1-9]\d{7,14}")


def _normalize_phone(value: str) -> str:
    """'079 123 45 67', '0041 79 …' or '+41 79 …' -> '+41791234567' (unvalidated)."""
    phone = re.sub(r"[\s./()-]", "", value)
    if phone.startswith("0041"):
        return "+41" + phone[4:]
    if phone.startswith("0"):
        return "+41" + phone[1:]
    return phone


# Lengths mirror the columns of TenantProfile: without them an oversize value
# reaches the INSERT and raises a DataError (500) instead of a 422.
Text255 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]


class TenantProfileUpdate(BaseModel):
    """Full replacement of the editable profile — every field must be sent.

    A partial payload is rejected instead of being completed with defaults,
    which would silently wipe the fields left out.
    """

    company_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ]
    address_line1: Text255
    address_line2: Text255 | None
    postal_code: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]
    city: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
    country: Annotated[
        str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=2, max_length=2)
    ]
    iban: str | None
    twint_phone: str | None
    phone: str | None
    vat_number: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None
    default_vat_rate: Decimal | None = Field(ge=0, le=1)
    invoice_prefix: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)
    ]
    payment_terms_days: int = Field(ge=0, le=365)

    @field_validator("address_line2", "vat_number", mode="after")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return value or None

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

    @field_validator("phone", mode="after")
    @classmethod
    def _validate_phone(cls, value: str | None) -> str | None:
        phone = _normalize_phone(value or "")
        if not phone:
            return None
        if not _PHONE.fullmatch(phone):
            raise ValueError("Invalid phone number")
        return phone

    @field_validator("twint_phone", mode="after")
    @classmethod
    def _validate_twint_phone(cls, value: str | None) -> str | None:
        phone = _normalize_phone(value or "")
        if not phone:
            return None
        if not _TWINT_PHONE.fullmatch(phone):
            raise ValueError("Invalid TWINT number: a Swiss mobile number is required")
        return phone


class TenantProfileResponse(BaseModel):
    """Read model, deliberately free of input validators: a row that predates
    the current rules must still be served, otherwise the settings page that
    would fix it can never be reached."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    company_name: str
    address_line1: str
    address_line2: str | None
    postal_code: str
    city: str
    country: str
    iban: str | None
    twint_phone: str | None
    phone: str | None
    vat_number: str | None
    default_vat_rate: Decimal | None
    invoice_prefix: str
    payment_terms_days: int
    is_complete: bool
