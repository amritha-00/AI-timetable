"""
FastAPI application entrypoint.

Run with:
    uvicorn app.main:app --reload --port 8000
(from the `backend/` directory, with the virtualenv activated)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    admin,
    auth,
    billing,
    classes,
    constraints,
    days,
    export,
    periods,
    requirements,
    rooms,
    subjects,
    teachers,
    timetables,
)

app = FastAPI(
    title="AI School Timetable Generator API",
    description=(
        "Backend for an AI-assisted school timetable generator. "
        "CP-SAT (OR-Tools) builds the schedule; an LLM only translates "
        "plain-English constraints into structured objects the solver consumes."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(teachers.router)
app.include_router(subjects.router)
app.include_router(classes.router)
app.include_router(rooms.router)
app.include_router(days.router)
app.include_router(periods.router)
app.include_router(requirements.router)
app.include_router(timetables.router)
app.include_router(constraints.router)
app.include_router(export.router)


@app.get("/api/health", tags=["health"])
def health_check() -> dict:
    """Simple liveness check - does not touch the database."""
    return {"status": "ok", "env": settings.app_env}
