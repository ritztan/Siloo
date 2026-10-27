"""List / get / create / update / delete endpoints for a simple table."""

from typing import Callable, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from .. import activity
from ..db import get_db, one, run
from ..schemas import to_row


def crud_router(
    *,
    table: str,
    prefix: str,
    label: str,
    create_model: type[BaseModel],
    update_model: type[BaseModel],
    order_by: str = "created_at",
    search_column: Optional[str] = None,
    select: str = "*",
    has_status: bool = False,
    # for "Undo last action": how to name a record, and how to describe an edit
    name_of: Callable[[dict], str] = lambda row: row.get("name") or "record",
    added_word: str = "Added",
    describe_update: Optional[Callable[[Client, dict, dict], str]] = None,
    before_list: Optional[Callable[[Client], None]] = None,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[table])

    @router.get("")
    def list_items(
        q: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        db: Client = Depends(get_db),
    ):
        """q searches by name; status filters tables that have a status column."""
        if before_list:
            before_list(db)
        query = db.table(table).select(select).order(order_by, desc=True).limit(min(max(limit, 1), 500))
        if q and search_column:
            query = query.ilike(search_column, f"%{q}%")
        if status and has_status:
            query = query.eq("status", status)
        return run(query)

    @router.get("/{item_id}")
    def get_item(item_id: UUID, db: Client = Depends(get_db)):
        return one(run(db.table(table).select(select).eq("id", str(item_id))), label)

    @router.post("", status_code=201)
    def create_item(body: create_model, db: Client = Depends(get_db)):  # type: ignore[valid-type]
        created = one(run(db.table(table).insert(to_row(body))), label)
        activity.log(db, action=f"{table}.create", table=table, record_id=created["id"], kind="insert",
                     row=None, label=f"{added_word} {name_of(created)}")
        return created

    @router.patch("/{item_id}")
    def update_item(item_id: UUID, body: update_model, db: Client = Depends(get_db)):  # type: ignore[valid-type]
        changes = to_row(body, partial=True)
        if not changes:
            raise HTTPException(422, "Nothing to update.")
        before = activity.snapshot(db, table, str(item_id))
        updated = one(run(db.table(table).update(changes).eq("id", str(item_id))), label)
        if before:
            text = describe_update(db, before, changes) if describe_update else f"Edited {name_of(before)}"
            activity.log(db, action=f"{table}.update", table=table, record_id=str(item_id), kind="update",
                         row=before, label=text)
        return updated

    @router.delete("/{item_id}", status_code=204)
    def delete_item(item_id: UUID, db: Client = Depends(get_db)):
        before = activity.snapshot(db, table, str(item_id))
        one(run(db.table(table).delete().eq("id", str(item_id))), label)
        if before:
            activity.log(db, action=f"{table}.delete", table=table, record_id=str(item_id), kind="delete",
                         row=before, label=f"Removed {name_of(before)}")

    return router
