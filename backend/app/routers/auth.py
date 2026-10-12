"""Signup/login for the tenant model, plus a mock 'upgrade' (no real payment
processor - see `app/models/tenant.py` for the trial-counter fields this
flips)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_tenant, hash_password, verify_password
from app.db.session import get_db
from app.models.tenant import Tenant
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest, TenantOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    existing = db.scalar(select(Tenant).where(Tenant.email == payload.email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try signing in instead.",
        )

    tenant = Tenant(
        school_name=payload.school_name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(tenant)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.") from exc
    db.refresh(tenant)

    return AuthResponse(access_token=create_access_token(tenant.id), tenant=TenantOut.model_validate(tenant))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    tenant = db.scalar(select(Tenant).where(Tenant.email == payload.email.lower()))
    if tenant is None or not verify_password(payload.password, tenant.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")

    return AuthResponse(access_token=create_access_token(tenant.id), tenant=TenantOut.model_validate(tenant))


@router.get("/me", response_model=TenantOut)
def me(tenant: Tenant = Depends(get_current_tenant)) -> Tenant:
    return tenant


@router.post("/upgrade", response_model=TenantOut)
def upgrade(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)) -> Tenant:
    """Mock billing: no payment processor is wired up. In a real deployment
    this would instead be a webhook handler reacting to a completed
    checkout, not an endpoint the client can call directly."""
    tenant.is_subscribed = True
    db.commit()
    db.refresh(tenant)
    return tenant
