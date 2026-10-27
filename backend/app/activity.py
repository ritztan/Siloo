"""Remembers each coordinator change so "Undo last action" can reverse it.

Every entry in activity_log stores what the record looked like BEFORE the change:
  before_data = {
    "label":   "Approved Reyes Farm",          # shown in the sidebar
    "kind":    "insert" | "update" | "delete",
    "row":     {...} or None,                    # the record before the change
    "related": [{"table", "id", "kind", "row"}]  # other records the action changed
  }
Undo puts every record back the way it was, then removes the entry.
"""

from typing import Any, Dict, List, Optional

from supabase import Client

from .db import run

# Columns the database fills in by itself; never written back on undo
SKIP_ON_RESTORE = {"id", "created_at", "updated_at"}


def snapshot(db: Client, table: str, record_id: str) -> Optional[dict]:
    """The record as it is right now (plain columns only)."""
    rows = run(db.table(table).select("*").eq("id", record_id))
    return rows[0] if rows else None


def related(table: str, record_id: str, kind: str, row: Optional[dict]) -> dict:
    return {"table": table, "id": record_id, "kind": kind, "row": row}


def log(
    db: Client,
    *,
    action: str,
    table: str,
    record_id: str,
    kind: str,
    row: Optional[dict],
    label: str,
    extra: Optional[List[dict]] = None,
) -> None:
    """Save an undo entry. Never lets a logging problem break the real action."""
    try:
        run(db.table("activity_log").insert({
            "action": action,
            "table_name": table,
            "record_id": record_id,
            "before_data": {"label": label, "kind": kind, "row": row, "related": extra or []},
        }))
    except Exception:  # noqa: BLE001 - undo history is a convenience
        pass


def _reverse(db: Client, table: str, record_id: str, kind: str, row: Optional[dict]) -> None:
    if kind == "insert":
        run(db.table(table).delete().eq("id", record_id))
    elif kind == "update" and row:
        restore: Dict[str, Any] = {k: v for k, v in row.items() if k not in SKIP_ON_RESTORE}
        run(db.table(table).update(restore).eq("id", record_id))
    elif kind == "delete" and row:
        run(db.table(table).insert(row))


def last_entry(db: Client) -> Optional[dict]:
    """The signed-in coordinator's most recent change that can still be undone."""
    rows = run(
        db.table("activity_log").select("*")
        .order("created_at", desc=True).order("id", desc=True).limit(1)
    )
    return rows[0] if rows else None


def undo(db: Client, entry: dict) -> str:
    data = entry["before_data"] or {}
    main = related(entry_table(entry), entry_record(entry), data.get("kind", "update"), data.get("row"))
    # Put back the main record first when it was deleted (others may point at it),
    # otherwise undo the related changes first.
    steps = [main] + list(data.get("related") or []) if main["kind"] == "delete" else list(data.get("related") or []) + [main]
    for step in steps:
        _reverse(db, step["table"], step["id"], step["kind"], step["row"])
    run(db.table("activity_log").delete().eq("id", entry["id"]))
    return data.get("label") or "last action"


def entry_table(entry: dict) -> str:
    return entry.get("table_name") or entry["action"].split(".")[0]


def entry_record(entry: dict) -> str:
    return str(entry.get("record_id"))
