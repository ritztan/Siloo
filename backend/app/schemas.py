"""Request bodies. Field names match the database columns."""

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
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
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization: Optional[str] = None


# ---------- farmers ----------

FarmerStatus = Literal["pending", "approved", "rejected"]


class FarmerIn(BaseModel):
    farm_name: str = Field(min_length=1)
    contact_name: str = ""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    location: Optional[str] = None


class FarmerUpdate(BaseModel):
    farm_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    location: Optional[str] = None


# ---------- volunteers ----------

class VolunteerIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: bool = True


class VolunteerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


# ---------- recipients ----------

RecipientType = Literal["food_bank", "kitchen", "pantry", "shelter", "other"]


class RecipientIn(BaseModel):
    name: str = Field(min_length=1)
    type: RecipientType = "food_bank"
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class RecipientUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[RecipientType] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


# ---------- donations ----------

DonationStatus = Literal["new", "matched", "pickup_scheduled", "delivered", "expired", "cancelled"]


class DonationIn(BaseModel):
    produce: str = Field(min_length=1)
    quantity_kg: Decimal = Field(gt=0)
    farmer_id: UUID
    recipient_id: Optional[UUID] = None
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None


class DonationUpdate(BaseModel):
    produce: Optional[str] = None
    quantity_kg: Optional[Decimal] = Field(default=None, gt=0)
    recipient_id: Optional[UUID] = None
    status: Optional[DonationStatus] = None
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None


# ---------- pickups ----------

PickupStatus = Literal["scheduled", "in_progress", "completed", "cancelled"]


class PickupIn(BaseModel):
    donation_id: UUID
    scheduled_at: datetime
    volunteer_id: Optional[UUID] = None


class PickupUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    volunteer_id: Optional[UUID] = None
    status: Optional[PickupStatus] = None


def to_row(model: BaseModel, *, partial: bool = False) -> dict:
    """Model -> JSON-safe dict for Supabase. partial=True keeps only fields that were sent."""
    return model.model_dump(mode="json", exclude_unset=partial)
