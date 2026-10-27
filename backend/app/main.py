"""Silo API — run with:  uvicorn app.main:app --reload  (from the backend folder)"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .routers import auth, dashboard, farmer, history, reports, resources

app = FastAPI(
    title="Silo API",
    description="Food rescue network backend. Data lives in Supabase.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_origin_regex=config.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
def health():
    return {"status": "ok", "service": "silo-api", "docs": "/docs"}


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(farmer.router)
app.include_router(reports.router)
app.include_router(history.router)
app.include_router(resources.farmers)
app.include_router(resources.volunteers)
app.include_router(resources.recipients)
app.include_router(resources.donations)
app.include_router(resources.pickups)
