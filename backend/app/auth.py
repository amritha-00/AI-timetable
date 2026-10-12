"""
Minimal JWT-based auth for the tenant model: one login per school (no
separate users table - see `app/models/tenant.py`). Uses stdlib `hashlib`
(PBKDF2-HMAC-SHA256) for password hashing instead of bcrypt/passlib, so no
extra native dependency is required; `PyJWT` (already a transitive dep of
other packages, see requirements.txt) issues the bearer tokens.
"""
from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.tenant import Tenant

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=30)
_PBKDF2_ITERATIONS = 390_000

_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_hex, digest_hex = password_hash.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return hmac.compare_digest(actual, expected)


def create_access_token(tenant_id: int) -> str:
    payload = {"sub": str(tenant_id), "exp": datetime.now(timezone.utc) + TOKEN_TTL}
    return jwt.encode(payload, settings.app_secret_key, algorithm=ALGORITHM)


def create_admin_token() -> str:
    """A separate token kind for the platform owner (not a tenant) - see
    `app/routers/admin.py`. Marked with `admin: True` so a tenant token can
    never be mistaken for one, and vice versa."""
    payload = {"admin": True, "exp": datetime.now(timezone.utc) + TOKEN_TTL}
    return jwt.encode(payload, settings.app_secret_key, algorithm=ALGORITHM)


def get_current_admin(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme)) -> None:
    """FastAPI dependency for the admin-only router. 401s unless the token
    was issued by `create_admin_token` - a tenant's own token is rejected."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in as admin to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(credentials.credentials, settings.app_secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your admin session has expired.") from exc
    if payload.get("admin") is not True:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin session.")


def get_current_tenant(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
    token: str | None = None,
) -> Tenant:
    """FastAPI dependency: resolves the bearer token to a `Tenant` row, or
    401s. Every data-bearing router depends on this and filters/scopes its
    queries by the returned tenant's id.

    Accepts the token via the `Authorization: Bearer` header (normal case)
    or a `?token=` query param - the latter only exists because a plain
    `<a href>` download link (the export endpoints) can't attach a header,
    so the frontend appends the token to those links instead."""
    raw_token = credentials.credentials if credentials else token
    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(raw_token, settings.app_secret_key, algorithms=[ALGORITHM])
        tenant_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found. Please sign in again.")
    return tenant
