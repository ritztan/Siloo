"""Request bodies. Field names match the database columns."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

# ---------- auth ----------

class SignUp(BaseModel):
    """Public sign-up is for farmers. The account starts as pending review."""
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)
    phone: str = Field(min_length=7)
    farm_name: str = Field(min_length=1)
    farm_address: str = Field(min_length=1)
    cooperative: Optional[str] = None


LoginRole = Literal["farmer", "coordinator"]


class SignIn(BaseModel):
    email: EmailStr
    password: str
    # Which login card was used. Farmers can't use the coordinator login and vice versa.
    role: Optional[LoginRole] = None


class Refresh(BaseModel):
    refresh_token: str


class ForgotPassword(BaseModel):
    email: EmailStr
    # Where the link in the email should open (the website's address)
    redirect_to: Optional[str] = None


class ResetPassword(BaseModel):
    # The access_token from the reset link (the website reads it from the address bar)
    access_token: str = Field(min_length=10)
    password: str = Field(min_length=6)


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization: Optional[str] = None


# ---------- farmers ----------

FarmerStatus = Literal["pending", "approved", "rejected", "suspended"]


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

VehicleType = Literal["none", "motorcycle", "car", "pickup", "van", "truck"]


class VolunteerIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    service_area: Optional[str] = None
    vehicle_type: VehicleType = "none"
    capacity_kg: Optional[Decimal] = Field(default=None, ge=0)
    is_active: bool = True


class VolunteerUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    service_area: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    capacity_kg: Optional[Decimal] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


# ---------- recipients ----------

RecipientType = Literal["food_bank", "kitchen", "pantry", "shelter", "rescue_partner", "other"]
RecipientStatus = Literal["open", "limited", "closed"]


class RecipientIn(BaseModel):
    name: str = Field(min_length=1)
    type: RecipientType = "food_bank"
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    capacity: Optional[str] = None
    needs: Optional[str] = None
    status: RecipientStatus = "open"


class RecipientUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    type: Optional[RecipientType] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    capacity: Optional[str] = None
    needs: Optional[str] = None
    status: Optional[RecipientStatus] = None


# ---------- donations ----------

DonationStatus = Literal["new", "matched", "pickup_scheduled", "delivered", "rejected", "expired", "cancelled"]


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


Unit = Literal["kg", "g", "tonne"]
Condition = Literal["fresh", "good", "fair"]
Logistics = Literal["pickup", "deliver"]


class FarmerDonationIn(BaseModel):
    """A donation a farmer logs from the "Log surplus crop" form (also used for Edit)."""
    crop_id: UUID
    quantity: Decimal = Field(gt=0)
    unit: Unit = "kg"
    harvested_at: date
    condition: Condition = "fresh"
    logistics: Logistics = "pickup"
    use_saved_location: bool = True
    # only when use_saved_location is False: where to collect the crop
    pickup_address: Optional[str] = Field(default=None, max_length=300)
    notes: Optional[str] = Field(default=None, max_length=500)


FarmerDonationUpdate = FarmerDonationIn


class FarmProfileUpdate(BaseModel):
    """The "Farm profile" form."""
    contact_name: str = Field(min_length=1)
    phone: str = Field(min_length=7)
    email: EmailStr
    cooperative: Optional[str] = None
    farm_name: str = Field(min_length=1)
    location: str = Field(min_length=1)  # barangay, municipality / city
    usual_logistics: Logistics = "pickup"
    new_password: Optional[str] = Field(default=None, min_length=6)


class RejectDonation(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


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
