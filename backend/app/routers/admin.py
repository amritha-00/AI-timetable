"""Platform-owner admin panel: lists every signed-up school and lets the
owner grant/revoke the unlimited plan by hand (the same mock-billing flip
`POST /api/auth/upgrade` does for a tenant on itself). Not reachable with a
tenant's own token - see `get_current_admin`."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import create_admin_token, get_current_admin
from app.config import settings
from app.db.session import get_db
from app.models.school_class import SchoolClass
from app.models.teacher import Teacher
from app.models.tenant import Tenant
from app.models.timetable import Timetable
from app.schemas.admin import AdminLoginRequest, AdminLoginResponse, SetSubscriptionRequest, TenantAdminOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest) -> AdminLoginResponse:
    if payload.email.lower() != settings.admin_email.lower() or payload.password != settings.admin_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    return AdminLoginResponse(access_token=create_admin_token())


@router.get("/tenants", response_model=list[TenantAdminOut], dependencies=[Depends(get_current_admin)])
def list_tenants(db: Session = Depends(get_db)) -> list[TenantAdminOut]:
    tenants = list(db.scalars(select(Tenant).order_by(Tenant.created_at.desc())).all())

    def count(model, tenant_id: int) -> int:
        return db.scalar(select(func.count()).select_from(model).where(model.tenant_id == tenant_id)) or 0

    return [
        TenantAdminOut(
            id=t.id,
            school_name=t.school_name,
            email=t.email,
            is_subscribed=t.is_subscribed,
            trial_generations_used=t.trial_generations_used,
            trial_generations_remaining=t.trial_generations_remaining,
            created_at=t.created_at,
            teacher_count=count(Teacher, t.id),
            class_count=count(SchoolClass, t.id),
            timetable_count=count(Timetable, t.id),
        )
        for t in tenants
    ]


@router.put("/tenants/{tenant_id}/subscription", response_model=TenantAdminOut, dependencies=[Depends(get_current_admin)])
def set_subscription(tenant_id: int, payload: SetSubscriptionRequest, db: Session = Depends(get_db)) -> TenantAdminOut:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tenant {tenant_id} not found")
    tenant.is_subscribed = payload.is_subscribed
    db.commit()
    db.refresh(tenant)

    def count(model) -> int:
        return db.scalar(select(func.count()).select_from(model).where(model.tenant_id == tenant_id)) or 0

    return TenantAdminOut(
        id=tenant.id,
        school_name=tenant.school_name,
        email=tenant.email,
        is_subscribed=tenant.is_subscribed,
        trial_generations_used=tenant.trial_generations_used,
        trial_generations_remaining=tenant.trial_generations_remaining,
        created_at=tenant.created_at,
        teacher_count=count(Teacher),
        class_count=count(SchoolClass),
        timetable_count=count(Timetable),
    )
