"""The farmer's side of Silo: their own dashboard and donations."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..db import get_db, one, run
from ..schemas import FarmerDonationIn, FarmerDonationUpdate, to_row

router = APIRouter(prefix="/farmer", tags=["farmer"])

DONATION_SELECT = (
    "*, recipient:recipients(name), "
    "pickups(id, scheduled_at, status, volunteer:volunteers(full_name, phone))"
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
            "message": "Your account is still pending review. You can post donations once a coordinator approves it.",
            "status": farm["status"],
        })


@router.get("/dashboard")
def farmer_dashboard(db: Client = Depends(get_db)):
    """Farm details, status, totals, and the farmer's donations (newest first)."""
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


@router.post("/donations", status_code=201)
def post_donation(body: FarmerDonationIn, db: Client = Depends(get_db)):
    """Post surplus harvest. Only approved farmers can do this."""
    farm = my_farm(db)
    _approved(farm)
    row = {**to_row(body), "farmer_id": farm["id"], "status": "new"}
    created = one(run(db.table("donations").insert(row)), "Donation")
    return one(run(db.table("donations").select(DONATION_SELECT).eq("id", created["id"])), "Donation")


@router.patch("/donations/{donation_id}")
def edit_donation(donation_id: UUID, body: FarmerDonationUpdate, db: Client = Depends(get_db)):
    """Edit a donation that hasn't been matched yet."""
    changes = to_row(body, partial=True)
    if not changes:
        raise HTTPException(422, "Nothing to update.")
    rows = run(db.table("donations").update(changes).eq("id", str(donation_id)))
    return one(rows, "Donation (only new, unmatched donations can be edited)")


@router.post("/donations/{donation_id}/cancel")
def cancel_donation(donation_id: UUID, db: Client = Depends(get_db)):
    """Cancel a donation that hasn't been matched yet."""
    rows = run(db.table("donations").update({"status": "cancelled"}).eq("id", str(donation_id)))
    return one(rows, "Donation (only new, unmatched donations can be cancelled)")
