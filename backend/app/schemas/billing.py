"""Schemas for the Stripe billing flow - see app/routers/billing.py."""
from __future__ import annotations

from pydantic import BaseModel

from app.schemas.auth import TenantOut


class CheckoutResponse(BaseModel):
    """Exactly one of these is set. `checkout_url` means Stripe is live -
    the frontend redirects the browser there. `tenant` means Stripe isn't
    configured (local dev without a Stripe account) and the mock fallback
    just flipped the plan immediately, same as the old /api/auth/upgrade."""

    checkout_url: str | None = None
    tenant: TenantOut | None = None


class PortalResponse(BaseModel):
    portal_url: str
