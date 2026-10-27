"""Sidebar info for coordinators: the last change (with Undo) and pending farmers."""

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from .. import activity
from ..db import get_db, run

router = APIRouter(tags=["undo"])


def _public(entry):
    if not entry:
        return None
    return {
        "id": entry["id"],
        "label": (entry.get("before_data") or {}).get("label") or "Last change",
        "created_at": entry["created_at"],
    }


@router.get("/sidebar")
def sidebar(db: Client = Depends(get_db)):
    """What the coordinator sidebar shows: last undoable change and the pending-farmers badge."""
    pending = run(db.table("farmers").select("id").eq("status", "pending"))
    return {"last_action": _public(activity.last_entry(db)), "farmers_pending": len(pending)}


@router.get("/activity/last")
def last_action(db: Client = Depends(get_db)):
    return _public(activity.last_entry(db))


@router.post("/activity/undo")
def undo_last(db: Client = Depends(get_db)):
    """Reverse your most recent change."""
    entry = activity.last_entry(db)
    if not entry:
        raise HTTPException(404, "Nothing to undo.")
    label = activity.undo(db, entry)
    return {"undone": label, "last_action": _public(activity.last_entry(db))}
