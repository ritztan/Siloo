"""The farmer portal: Home, Log surplus, My donations, Farm profile."""

from datetime import datetime, time, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..db import get_db, get_token, one, run
from ..schemas import FarmerDonationIn, FarmProfileUpdate, to_row
from .auth import _gotrue_message, _user, gotrue

router = APIRouter(prefix="/farmer", tags=["farmer"])

# Days and "end of day" are counted in Philippine time
PH = timezone(timedelta(hours=8))
UNIT_TO_KG = {"kg": 1.0, "g": 0.001, "tonne": 1000.0}

DONATION_SELECT = (
    "*, crop:crops(id, name, shelf_life_days), recipient:recipients(name), "
    "pickups(id, scheduled_at, status)"
)


def my_farm(db: Client) -> dict:
    """The signed-in farmer's farm record, or 403 for non-farmers."""
    farmer_id = run(db.rpc("my_farmer_id"))
    if not farmer_id:
        raise HTTPException(403, "This page is for farmer accounts.")
    return one(run(db.table("farmers").select("*").eq("id", farmer_id)), "Farm")


def _approved(farm: dict) -> None:
    if farm["status"] != "approved":
        raise HTTPException(403, {
            "message": "Your account isn't approved yet, so you can't post donations. "
                       "A coordinator needs to approve it first.",
            "status": farm["status"],
        })


def expire_overdue(db: Client) -> None:
    """Posted donations past their shelf life become Expired."""
    try:
        run(db.rpc("expire_overdue_donations"))
    except HTTPException:
        pass  # never block a page over this


def _donation_row(db: Client, farm: dict, body: FarmerDonationIn) -> dict:
    """Turn the form into a database row: crop name, kg, expiry date, pickup point."""
    crops = run(db.table("crops").select("*").eq("id", str(body.crop_id)))
    if not crops:
        raise HTTPException(422, "Choose a crop from the list.")
    crop = crops[0]

    today = datetime.now(PH).date()
    if body.harvested_at > today:
        raise HTTPException(422, "Harvest date can't be in the future.")
    expires = datetime.combine(body.harvested_at + timedelta(days=crop["shelf_life_days"]), time(23, 59), PH)
    if expires < datetime.now(PH):
        raise HTTPException(422, f"This {crop['name'].lower()} is already past its {crop['shelf_life_days']}-day shelf life, so it can't be posted.")

    quantity_kg = round(float(body.quantity) * UNIT_TO_KG[body.unit], 2)
    if quantity_kg <= 0:
        raise HTTPException(422, "Quantity is too small. Enter at least 0.01 kg.")

    if body.use_saved_location:
        address = farm.get("location")
        if not address:
            raise HTTPException(422, "Your farm has no saved address yet. Add it in Farm profile, or choose a different pickup point.")
    else:
        address = (body.pickup_address or "").strip()
        if not address:
            raise HTTPException(422, "Type the address of the different pickup point.")

    return {
        "crop_id": str(body.crop_id),
        "produce": crop["name"],
        "quantity": float(body.quantity),
        "unit": body.unit,
        "quantity_kg": quantity_kg,
        "harvested_at": body.harvested_at.isoformat(),
        "shelf_life_days": crop["shelf_life_days"],
        "farmer_shelf_life_days": body.farmer_shelf_life_days,
        "expires_at": expires.isoformat(),
        "condition": body.condition,
        "logistics": body.logistics,
        "use_saved_location": body.use_saved_location,
        "pickup_address": address,
        "notes": (body.notes or "").strip() or None,
    }


# ---------- crops ----------

@router.get("/crops")
def crops(db: Client = Depends(get_db)):
    """The crop shelf-life table (for the "Crop type" list)."""
    return run(db.table("crops").select("id, name, shelf_life_days").order("name"))


# ---------- home / my donations ----------

@router.get("/dashboard")
def farmer_dashboard(db: Client = Depends(get_db)):
    """Farm details, totals, and all of the farmer's donations (newest first)."""
    expire_overdue(db)
    farm = my_farm(db)
    donations = run(
        db.table("donations").select(DONATION_SELECT)
        .eq("farmer_id", farm["id"]).order("created_at", desc=True)
    )
    delivered = [d for d in donations if d["status"] == "delivered"]
    active = [d for d in donations if d["status"] in ("new", "matched", "pickup_scheduled")]
    upcoming = sorted(
        (p for d in donations for p in (d.get("pickups") or []) if p["status"] == "scheduled"),
        key=lambda p: p["scheduled_at"],
    )
    return {
        "farm": farm,
        "stats": {
            "active_donations": len(active),
            "delivered_donations": len(delivered),
            "kg_rescued": round(sum(float(d["quantity_kg"]) for d in delivered), 2),
            "total_donations": len(donations),
            "next_pickup_at": upcoming[0]["scheduled_at"] if upcoming else None,
        },
        "donations": donations,
    }


@router.get("/donations/{donation_id}")
def get_donation(donation_id: UUID, db: Client = Depends(get_db)):
    return one(run(db.table("donations").select(DONATION_SELECT).eq("id", str(donation_id))), "Donation")


@router.post("/donations", status_code=201)
def post_donation(body: FarmerDonationIn, db: Client = Depends(get_db)):
    """Log surplus crop. Only approved farmers can do this."""
    farm = my_farm(db)
    _approved(farm)
    row = {**_donation_row(db, farm, body), "farmer_id": farm["id"], "status": "new"}
    created = one(run(db.table("donations").insert(row)), "Donation")
    return get_donation(UUID(created["id"]), db)


@router.patch("/donations/{donation_id}")
def edit_donation(donation_id: UUID, body: FarmerDonationIn, db: Client = Depends(get_db)):
    """Edit a donation while it is still Posted."""
    farm = my_farm(db)
    _approved(farm)
    rows = run(db.table("donations").update(_donation_row(db, farm, body))
               .eq("id", str(donation_id)).eq("status", "new"))
    one(rows, "Donation (only Posted donations can be edited)")
    return get_donation(donation_id, db)


@router.delete("/donations/{donation_id}", status_code=204)
def delete_donation(donation_id: UUID, db: Client = Depends(get_db)):
    """Delete a donation while it is still Posted."""
    my_farm(db)
    one(run(db.table("donations").delete().eq("id", str(donation_id)).eq("status", "new")),
        "Donation (only Posted donations can be deleted)")


@router.post("/donations/{donation_id}/cancel")
def cancel_donation(donation_id: UUID, db: Client = Depends(get_db)):
    """Cancel a donation that hasn't been matched yet (kept for older screens)."""
    rows = run(db.table("donations").update({"status": "cancelled"}).eq("id", str(donation_id)))
    return one(rows, "Donation (only new, unmatched donations can be cancelled)")


# ---------- farm profile ----------

@router.get("/profile")
def get_profile(token: str = Depends(get_token), db: Client = Depends(get_db)):
    farm = my_farm(db)
    user = _user(token)
    return {"farm": farm, "email": user.email}


@router.patch("/profile")
def save_profile(body: FarmProfileUpdate, token: str = Depends(get_token), db: Client = Depends(get_db)):
    """Save contact, farm, location, usual logistics; optionally change email and password."""
    my_farm(db)
    user = _user(token)
    notes = []

    details = to_row(body)
    details.pop("new_password", None)
    new_email: Optional[str] = details.pop("email")
    run(db.rpc("update_my_farm", {"details": details}))

    if new_email and new_email.lower() != (user.email or "").lower():
        response = gotrue("PUT", "/user", token=token, json={"email": new_email})
        if response.status_code >= 400:
            message = _gotrue_message(response) or "That email couldn't be used."
            raise HTTPException(422 if response.status_code < 500 else 502, f"Email not changed: {message}")
        data = response.json()
        if (data.get("email") or "").lower() == new_email.lower():
            run(db.rpc("update_my_farm", {"details": {"email": new_email}}))
            notes.append(f"Your login email is now {new_email}.")
        else:
            notes.append(f"Check {new_email} for a link to confirm your new email.")

    if body.new_password:
        response = gotrue("PUT", "/user", token=token, json={"password": body.new_password})
        if response.status_code >= 400:
            message = _gotrue_message(response).lower()
            if "different" in message or "same" in message:
                raise HTTPException(422, "Your new password must be different from your current one.")
            if "reauthentication" in message or "recent" in message:
                raise HTTPException(422, "For security, log out and log in again, then change your password.")
            raise HTTPException(422, f"Password not changed: {_gotrue_message(response) or 'try a stronger password'}.")
        notes.append("Your password was changed.")

    return {**get_profile(token, db), "message": " ".join(["Changes saved."] + notes)}
