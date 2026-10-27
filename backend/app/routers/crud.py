"""List / get / create / update / delete endpoints for a simple table."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

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
    search_column: str | None = None,
    select: str = "*",
    has_status: bool = False,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[table])

    @router.get("")
    def list_items(
        q: str | None = None,
        status: str | None = None,
        limit: int = 100,
        db: Client = Depends(get_db),
    ):
        """q searches by name; status filters tables that have a status column."""
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
        return one(run(db.table(table).insert(to_row(body))), label)

    @router.patch("/{item_id}")
    def update_item(item_id: UUID, body: update_model, db: Client = Depends(get_db)):  # type: ignore[valid-type]
        changes = to_row(body, partial=True)
        if not changes:
            raise HTTPException(422, "Nothing to update.")
        return one(run(db.table(table).update(changes).eq("id", str(item_id))), label)

    @router.delete("/{item_id}", status_code=204)
    def delete_item(item_id: UUID, db: Client = Depends(get_db)):
        one(run(db.table(table).delete().eq("id", str(item_id))), label)

    return router
