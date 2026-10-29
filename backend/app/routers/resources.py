"""Farmers, recipients, donations, pickups."""

from typing import Optional
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from .. import activity
from ..db import get_db, get_token, one, run
from ..schemas import (
    DonationIn, DonationUpdate, FarmerIn, FarmerUpdate, PickupIn, PickupUpdate,
    RecipientIn, RecipientUpdate, RejectDonation, to_row,
)
from .auth import _user_id
from .crud import crud_router
from .farmer import expire_overdue

# ---------- farmers ----------

farmers = crud_router(
    table="farmers", prefix="/farmers", label="Farmer",
    create_model=FarmerIn, update_model=FarmerUpdate,
    search_column="farm_name", has_status=True,
    # each farmer comes with their donations' produce, for counts on the Farmers page
    select="*, donations(produce, status, created_at)",
    name_of=lambda row: row.get("farm_name") or "farm",
)


REVIEW_WORDS = {"approved": "Approved", "rejected": "Rejected", "suspended": "Suspended"}


def _review(farmer_id: UUID, new_status: str, token: str, db: Client) -> dict:
    changes = {
        "status": new_status,
        "reviewed_by": _user_id(token),
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    before = activity.snapshot(db, "farmers", str(farmer_id))
    updated = one(run(db.table("farmers").update(changes).eq("id", str(farmer_id))), "Farmer")
    if before:
        activity.log(db, action=f"farmers.{new_status}", table="farmers", record_id=str(farmer_id),
                     kind="update", row=before, label=f"{REVIEW_WORDS[new_status]} {before['farm_name']}")
    return updated


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


# ---------- recipients ----------

recipients = crud_router(
    table="recipients", prefix="/recipients", label="Recipient",
    create_model=RecipientIn, update_model=RecipientUpdate, search_column="name",
    # each recipient comes with the donations sent to them, for totals
    select="*, donations(quantity_kg, status, delivered_at)",
    has_status=True,
)

# ---------- donations ----------
# Each donation comes back with its farm and recipient attached.


def _describe_donation(db: Client, before: dict, changes: dict) -> str:
    produce = before.get("produce") or "donation"
    if changes.get("status") == "matched" and changes.get("recipient_id"):
        recipient = activity.snapshot(db, "recipients", str(changes["recipient_id"]))
        return f"Matched {produce} → {recipient['name'] if recipient else 'a recipient'}"
    if changes.get("status") == "cancelled":
        return f"Cancelled {produce}"
    if changes.get("status") == "delivered":
        return f"Marked {produce} received"
    return f"Edited {produce}"


donations = crud_router(
    table="donations", prefix="/donations", label="Donation",
    create_model=DonationIn, update_model=DonationUpdate,
    search_column="produce", has_status=True,
    select=(
        "*, farmer:farmers(id, farm_name), recipient:recipients(id, name), "
        "pickups(id, scheduled_at, status)"
    ),
    name_of=lambda row: row.get("produce") or "donation",
    added_word="Logged",
    describe_update=_describe_donation,
    before_list=expire_overdue,
)


@donations.post("/{donation_id}/reject", tags=["donations"])
def reject_donation(donation_id: UUID, body: RejectDonation, db: Client = Depends(get_db)):
    """The recipient can't take it: mark Rejected with a reason the farmer will see."""
    before = activity.snapshot(db, "donations", str(donation_id))
    rows = run(
        db.table("donations").update({"status": "rejected", "rejection_reason": body.reason.strip()})
        .eq("id", str(donation_id)).in_("status", ["new", "matched"])
    )
    updated = one(rows, "Donation (only Posted or Matched donations can be rejected)")
    if before:
        activity.log(db, action="donations.rejected", table="donations", record_id=str(donation_id),
                     kind="update", row=before, label=f"Rejected {before['produce']}")
    return updated


@donations.post("/{donation_id}/receive", tags=["donations"])
def receive_donation(donation_id: UUID, db: Client = Depends(get_db)):
    """For farmers who deliver it themselves: mark the recipient as having received it."""
    before = activity.snapshot(db, "donations", str(donation_id))
    rows = run(
        db.table("donations")
        .update({"status": "delivered", "delivered_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(donation_id)).in_("status", ["matched", "pickup_scheduled"])
    )
    updated = one(rows, "Donation (match it to a recipient first)")
    if before:
        activity.log(db, action="donations.received", table="donations", record_id=str(donation_id),
                     kind="update", row=before, label=f"Marked {before['produce']} received")
    return updated

# ---------- pickups ----------

pickups = APIRouter(prefix="/pickups", tags=["pickups"])
PICKUP_SELECT = (
    "*, donation:donations(id, produce, quantity_kg, status, farmer:farmers(farm_name), "
    "recipient:recipients(name))"
)


@pickups.get("")
def list_pickups(
    day: Optional[str] = None,
    status: Optional[str] = None,
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
    return run(query)


@pickups.get("/{pickup_id}")
def get_pickup(pickup_id: UUID, db: Client = Depends(get_db)):
    return one(run(db.table("pickups").select(PICKUP_SELECT).eq("id", str(pickup_id))), "Pickup")


@pickups.post("", status_code=201)
def create_pickup(body: PickupIn, db: Client = Depends(get_db)):
    """Schedules a pickup and marks the donation as pickup_scheduled."""
    donation_before = activity.snapshot(db, "donations", str(body.donation_id))
    pickup = one(run(db.table("pickups").insert(to_row(body))), "Pickup")
    changed = run(
        db.table("donations").update({"status": "pickup_scheduled"})
        .eq("id", str(body.donation_id)).in_("status", ["new", "matched"])
    )
    produce = (donation_before or {}).get("produce", "donation")
    activity.log(
        db, action="pickups.create", table="pickups", record_id=pickup["id"], kind="insert", row=None,
        label=f"Scheduled pickup for {produce}",
        extra=[activity.related("donations", str(body.donation_id), "update", donation_before)] if changed else [],
    )
    return pickup


@pickups.patch("/{pickup_id}")
def update_pickup(pickup_id: UUID, body: PickupUpdate, db: Client = Depends(get_db)):
    """Reschedule or change status. Completing a pickup marks its donation as delivered."""
    changes = to_row(body, partial=True)
    if not changes:
        raise HTTPException(422, "Nothing to update.")
    pickup_before = activity.snapshot(db, "pickups", str(pickup_id))
    donation_before = (
        activity.snapshot(db, "donations", pickup_before["donation_id"]) if pickup_before else None
    )
    pickup = one(run(db.table("pickups").update(changes).eq("id", str(pickup_id))), "Pickup")
    _log_pickup_update(db, str(pickup_id), changes, pickup_before, donation_before)
    if changes.get("status") == "completed":
        run(
            db.table("donations")
            .update({"status": "delivered", "delivered_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", pickup["donation_id"])
        )
    elif changes.get("status") == "cancelled":
        # No other pickup planned for this donation? Put it back to "matched" so it can be rescheduled.
        others = run(
            db.table("pickups").select("id")
            .eq("donation_id", pickup["donation_id"])
            .in_("status", ["scheduled", "in_progress"])
        )
        if not others:
            run(
                db.table("donations").update({"status": "matched"})
                .eq("id", pickup["donation_id"]).eq("status", "pickup_scheduled")
            )
    return pickup


@pickups.delete("/{pickup_id}", status_code=204)
def delete_pickup(pickup_id: UUID, db: Client = Depends(get_db)):
    one(run(db.table("pickups").delete().eq("id", str(pickup_id))), "Pickup")


def _log_pickup_update(db: Client, pickup_id: str, changes: dict, before: Optional[dict], donation: Optional[dict]) -> None:
    if not before:
        return
    produce = (donation or {}).get("produce", "donation")
    status = changes.get("status")
    if status == "completed":
        label = f"Marked {produce} delivered"
    elif status == "cancelled":
        label = f"Cancelled pickup for {produce}"
    else:
        label = f"Updated pickup for {produce}"
    # completing or cancelling also changes the donation, so remember it too
    extra = [activity.related("donations", before["donation_id"], "update", donation)] if status in ("completed", "cancelled") and donation else []
    activity.log(db, action=f"pickups.{status or 'update'}", table="pickups", record_id=pickup_id,
                 kind="update", row=before, label=label, extra=extra)
