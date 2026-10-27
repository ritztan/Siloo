"""Request bodies. Field names match the database columns."""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

# ---------- auth ----------

class SignUp(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    organization: str = Field(min_length=1)


class SignIn(BaseModel):
    email: EmailStr
    password: str


class Refresh(BaseModel):
    refresh_token: str


class ProfileUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    organization: str | None = None


# ---------- farmers ----------

FarmerStatus = Literal["pending", "approved", "rejected"]


class FarmerIn(BaseModel):
    farm_name: str = Field(min_length=1)
    contact_name: str = ""
    email: EmailStr | None = None
    phone: str | None = None
    location: str | None = None


class FarmerUpdate(BaseModel):
    farm_name: str | None = None
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    location: str | None = None


# ---------- volunteers ----------

class VolunteerIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr | None = None
    phone: str | None = None
    is_active: bool = True


class VolunteerUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    is_active: bool | None = None


# ---------- recipients ----------

RecipientType = Literal["food_bank", "kitchen", "pantry", "shelter", "other"]


class RecipientIn(BaseModel):
    name: str = Field(min_length=1)
    type: RecipientType = "food_bank"
    contact_name: str | None = None
    phone: str | None = None
    address: str | None = None


class RecipientUpdate(BaseModel):
    name: str | None = None
    type: RecipientType | None = None
    contact_name: str | None = None
    phone: str | None = None
    address: str | None = None


# ---------- donations ----------

DonationStatus = Literal["new", "matched", "pickup_scheduled", "delivered", "expired", "cancelled"]


class DonationIn(BaseModel):
    produce: str = Field(min_length=1)
    quantity_kg: Decimal = Field(gt=0)
    farmer_id: UUID
    recipient_id: UUID | None = None
    expires_at: datetime | None = None
    notes: str | None = None


class DonationUpdate(BaseModel):
    produce: str | None = None
    quantity_kg: Decimal | None = Field(default=None, gt=0)
    recipient_id: UUID | None = None
    status: DonationStatus | None = None
    expires_at: datetime | None = None
    notes: str | None = None


# ---------- pickups ----------

PickupStatus = Literal["scheduled", "in_progress", "completed", "cancelled"]


class PickupIn(BaseModel):
    donation_id: UUID
    scheduled_at: datetime
    volunteer_id: UUID | None = None


class PickupUpdate(BaseModel):
    scheduled_at: datetime | None = None
    volunteer_id: UUID | None = None
    status: PickupStatus | None = None


def to_row(model: BaseModel, *, partial: bool = False) -> dict:
    """Model -> JSON-safe dict for Supabase. partial=True keeps only fields that were sent."""
    return model.model_dump(mode="json", exclude_unset=partial)
