"""Farmers, volunteers, recipients, donations, pickups."""

from typing import Optional
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..db import get_db, get_token, one, run
from ..schemas import (
    DonationIn, DonationUpdate, FarmerIn, FarmerUpdate, PickupIn, PickupUpdate,
    RecipientIn, RecipientUpdate, VolunteerIn, VolunteerUpdate, to_row,
)
from .auth import _user_id
from .crud import crud_router

# ---------- farmers ----------

farmers = crud_router(
    table="farmers", prefix="/farmers", label="Farmer",
    create_model=FarmerIn, update_model=FarmerUpdate,
    search_column="farm_name", has_status=True,
    # each farmer comes with their donations' produce, for counts on the Farmers page
    select="*, donations(produce, status, created_at)",
)


def _review(farmer_id: UUID, new_status: str, token: str, db: Client) -> dict:
    changes = {
        "status": new_status,
        "reviewed_by": _user_id(token),
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    return one(run(db.table("farmers").update(changes).eq("id", str(farmer_id))), "Farmer")


@farmers.post("/{farmer_id}/approve", tags=["farmers"])
def approve_farmer(farmer_id: UUID, token: str = Depends(get_token), db: Client = Depends(get_db)):
    return _review(farmer_id, "approved", token, db)


@farmers.post("/{farmer_id}/reject", tags=["farmers"])
def reject_farmer(farmer_id: UUID, token: str = Depends(get_token), db: Client = Depends(get_db)):
    return _review(farmer_id, "rejected", token, db)


@farmers.post("/{farmer_id}/suspend", tags=["farmers"])
def suspend_farmer(farmer_id: UUID, token: str = Depends(get_token), db: Client = Depends(get_db)):
    """Stop a farmer from posting donations (they can still log in and see their status)."""
    return _review(farmer_id, "suspended", token, db)


# ---------- volunteers & recipients ----------

volunteers = crud_router(
    table="volunteers", prefix="/volunteers", label="Volunteer",
    create_model=VolunteerIn, update_model=VolunteerUpdate, search_column="full_name",
)

recipients = crud_router(
    table="recipients", prefix="/recipients", label="Recipient",
    create_model=RecipientIn, update_model=RecipientUpdate, search_column="name",
)

# ---------- donations ----------
# Each donation comes back with its farm and recipient attached.

donations = crud_router(
    table="donations", prefix="/donations", label="Donation",
    create_model=DonationIn, update_model=DonationUpdate,
    search_column="produce", has_status=True,
    select="*, farmer:farmers(id, farm_name), recipient:recipients(id, name)",
)

# ---------- pickups ----------

pickups = APIRouter(prefix="/pickups", tags=["pickups"])
PICKUP_SELECT = (
    "*, donation:donations(id, produce, quantity_kg, status, farmer:farmers(farm_name), "
    "recipient:recipients(name)), volunteer:volunteers(id, full_name, phone)"
)


@pickups.get("")
def list_pickups(
    day: Optional[str] = None,
    status: Optional[str] = None,
    unassigned: bool = False,
    db: Client = Depends(get_db),
):
    """day=today or day=YYYY-MM-DD (Philippine time) limits to that day."""
    query = db.table("pickups").select(PICKUP_SELECT).order("scheduled_at")
    if day:
        ph = timezone(timedelta(hours=8))
        try:
            date = datetime.now(ph).date() if day == "today" else datetime.fromisoformat(day).date()
        except ValueError as exc:
            raise HTTPException(422, "day must be 'today' or YYYY-MM-DD.") from exc
        start = datetime(date.year, date.month, date.day, tzinfo=ph)
        query = query.gte("scheduled_at", start.isoformat()).lt(
            "scheduled_at", (start + timedelta(days=1)).isoformat()
        )
    if status:
        query = query.eq("status", status)
    if unassigned:
        query = query.is_("volunteer_id", "null")
    return run(query)


@pickups.get("/{pickup_id}")
def get_pickup(pickup_id: UUID, db: Client = Depends(get_db)):
    return one(run(db.table("pickups").select(PICKUP_SELECT).eq("id", str(pickup_id))), "Pickup")


@pickups.post("", status_code=201)
def create_pickup(body: PickupIn, db: Client = Depends(get_db)):
    """Schedules a pickup and marks the donation as pickup_scheduled."""
    pickup = one(run(db.table("pickups").insert(to_row(body))), "Pickup")
    run(
        db.table("donations").update({"status": "pickup_scheduled"})
        .eq("id", str(body.donation_id)).in_("status", ["new", "matched"])
    )
    return pickup


@pickups.patch("/{pickup_id}")
def update_pickup(pickup_id: UUID, body: PickupUpdate, db: Client = Depends(get_db)):
    """Assign a volunteer, reschedule, or change status.
    Completing a pickup marks its donation as delivered."""
    changes = to_row(body, partial=True)
    if not changes:
        raise HTTPException(422, "Nothing to update.")
    pickup = one(run(db.table("pickups").update(changes).eq("id", str(pickup_id))), "Pickup")
    if changes.get("status") == "completed":
        run(
            db.table("donations")
            .update({"status": "delivered", "delivered_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", pickup["donation_id"])
        )
    return pickup


@pickups.delete("/{pickup_id}", status_code=204)
def delete_pickup(pickup_id: UUID, db: Client = Depends(get_db)):
    one(run(db.table("pickups").delete().eq("id", str(pickup_id))), "Pickup")
