"""Reports: how much food the network rescued, where it went, and who received it."""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends
from supabase import Client

from ..db import get_db, run

router = APIRouter(prefix="/reports", tags=["reports"])

# Days are counted in Philippine time so "today" matches the coordinators' calendar.
PH = timezone(timedelta(hours=8))
KG_PER_MEAL = 0.5  # rough estimate used for "estimated meals"

Period = Literal["7d", "30d", "12m"]

RECIPIENT_TYPES = {
    "kitchen": "Community kitchens",
    "food_bank": "Food banks",
    "pantry": "Neighborhood pantries",
    "shelter": "Shelters",
    "rescue_partner": "Partner NGOs",
    "other": "Other partners",
}


def _local_day(iso: Optional[str]) -> Optional[date]:
    if not iso:
        return None
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(PH).date()


def _month_start(day: date, months_back: int = 0) -> date:
    month = day.month - 1 - months_back
    return date(day.year + month // 12, month % 12 + 1, 1)


def _top(totals: Dict[str, float], limit: int = 5) -> List[dict]:
    ranked = sorted(totals.items(), key=lambda item: item[1], reverse=True)[:limit]
    return [{"name": name, "kg": round(kg, 2)} for name, kg in ranked]


@router.get("")
def report(period: Period = "30d", db: Client = Depends(get_db)):
    """period: 7d, 30d (by day) or 12m (by month)."""
    today = datetime.now(PH).date()
    if period == "12m":
        start = _month_start(today, 11)
        previous_start = _month_start(today, 23)
    else:
        days = 7 if period == "7d" else 30
        start = today - timedelta(days=days - 1)
        previous_start = start - timedelta(days=days)

    donations = run(
        db.table("donations").select(
            "id, produce, quantity_kg, status, created_at, delivered_at, recipient_id, "
            "farmer:farmers(farm_name), recipient:recipients(name, type)"
        )
    )
    farms = run(db.table("farmers").select("id").eq("status", "approved"))
    recipients = run(db.table("recipients").select("id").neq("status", "closed"))

    def delivered_on(donation: dict) -> Optional[date]:
        if donation["status"] != "delivered":
            return None
        return _local_day(donation.get("delivered_at") or donation["created_at"])

    current = [d for d in donations if (delivered_on(d) or date.min) >= start]
    previous = [d for d in donations if previous_start <= (delivered_on(d) or date.min) < start]
    kg = sum(float(d["quantity_kg"]) for d in current)
    previous_kg = sum(float(d["quantity_kg"]) for d in previous)
    change = round((kg - previous_kg) / previous_kg * 100) if previous_kg else None

    posted = [d for d in donations if (_local_day(d["created_at"]) or date.min) >= start and d["status"] != "cancelled"]
    matched = [d for d in posted if d.get("recipient_id")]

    # ---- chart: one bar per day (7d / 30d) or per month (12m)
    buckets: Dict[str, float] = {}
    if period == "12m":
        for i in range(11, -1, -1):
            buckets[_month_start(today, i).isoformat()[:7]] = 0.0
        for d in current:
            buckets[delivered_on(d).isoformat()[:7]] += float(d["quantity_kg"])
        series = [{"key": k, "label": date.fromisoformat(k + "-01").strftime("%b"), "kg": round(v, 2)} for k, v in buckets.items()]
    else:
        for i in range((today - start).days + 1):
            buckets[(start + timedelta(days=i)).isoformat()] = 0.0
        for d in current:
            buckets[delivered_on(d).isoformat()] += float(d["quantity_kg"])
        series = [
            {
                "key": k,
                "label": date.fromisoformat(k).strftime("%a" if period == "7d" else "%b %d").replace(" 0", " "),
                "kg": round(v, 2),
            }
            for k, v in buckets.items()
        ]

    # ---- breakdowns
    by_type: Dict[str, float] = defaultdict(float)
    by_farm: Dict[str, float] = defaultdict(float)
    by_produce: Dict[str, float] = defaultdict(float)
    by_recipient: Dict[str, float] = defaultdict(float)
    by_partner_ngo: Dict[str, float] = defaultdict(float)
    for d in current:
        q = float(d["quantity_kg"])
        recipient = d.get("recipient") or {}
        by_type[RECIPIENT_TYPES.get(recipient.get("type") or "other", "Other partners")] += q
        by_recipient[recipient.get("name") or "Unknown"] += q
        if recipient.get("type") == "rescue_partner":
            by_partner_ngo[recipient.get("name") or "Unknown"] += q
        by_farm[(d.get("farmer") or {}).get("farm_name") or "Unknown farm"] += q
        by_produce[d["produce"].strip().capitalize()] += q

    where = [
        {"name": name, "kg": round(value, 2), "percent": round(value / kg * 100) if kg else 0}
        for name, value in sorted(by_type.items(), key=lambda item: item[1], reverse=True)
    ]

    return {
        "period": period,
        "start": start.isoformat(),
        "end": today.isoformat(),
        "totals": {
            "kg_rescued": round(kg, 2),
            "previous_kg_rescued": round(previous_kg, 2),
            "change_percent": change,
            "delivered_donations": len(current),
            "posted_donations": len(posted),
            "matched_percent": round(len(matched) / len(posted) * 100) if posted else None,
            "partner_farms": len(farms),
            "partner_recipients": len(recipients),
            "estimated_meals": int(kg / KG_PER_MEAL),
            "kg_per_meal": KG_PER_MEAL,
        },
        "series": series,
        "where_it_went": where,
        "top_farms": _top(by_farm),
        "top_produce": _top(by_produce),
        "top_recipients": _top(by_recipient),
        "top_partner_ngos": _top(by_partner_ngo),
    }
