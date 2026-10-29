"""Everything the Dashboard page needs in one call."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from supabase import Client

from ..db import get_db, run
from .farmer import expire_overdue

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(days: int = 7, db: Client = Depends(get_db)):
    """Stat cards, priority queue, recent activity, and the rescue-volume chart.
    days = 7 or 30 for the chart range."""
    days = 30 if days > 7 else 7
    expire_overdue(db)
    stats = run(db.table("dashboard_stats").select("*"))
    stats = stats[0] if stats else {}

    activity = run(db.table("donation_activity").select("*").limit(8))

    since = date.today() - timedelta(days=days - 1)
    rows = run(db.table("rescue_volume_daily").select("*").gte("day", since.isoformat()))
    by_day = {row["day"]: float(row["kg_rescued"]) for row in rows}
    volume = [
        {"day": (since + timedelta(days=i)).isoformat(),
         "kg_rescued": by_day.get((since + timedelta(days=i)).isoformat(), 0.0)}
        for i in range(days)
    ]

    queue = [
        item for item in [
            {"type": "farmers_pending", "count": stats.get("farmers_pending", 0),
             "title": "farmers waiting", "detail": "Review new account applications"},
            {"type": "donations_expiring", "count": stats.get("donations_expiring", 0),
             "title": "donations expiring", "detail": "Find a recipient within 4 hours"},
        ] if item["count"]
    ]

    return {
        "stats": stats,
        "priority_queue": queue,
        "priority_total": sum(item["count"] for item in queue),
        "activity": activity,
        "rescue_volume": volume,
    }
