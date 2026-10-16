"""
Stripe billing: a Checkout session for upgrading, a Billing Portal session
for managing/cancelling, and the webhook that's the actual source of truth
for `Tenant.is_subscribed` (never the client - a browser calling "mark me
subscribed" directly would just be free billing fraud).

Without Stripe keys configured (`settings.stripe_configured` is False), the
checkout endpoint falls back to the same mock "flip the flag" behavior the
old `/api/auth/upgrade` had - so local dev and a Stripe-less CI still work.
This mirrors how the LLM provider layer falls back to "mock" without an API
key (see app/llm/provider_factory.py).
"""
from __future__ import annotations

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_tenant
from app.config import settings
from app.db.session import get_db
from app.models.tenant import Tenant
from app.schemas.auth import TenantOut
from app.schemas.billing import CheckoutResponse, PortalResponse

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _stripe() -> None:
    stripe.api_key = settings.stripe_secret_key


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)) -> CheckoutResponse:
    if not settings.stripe_configured:
        # Mock fallback - see module docstring.
        tenant.is_subscribed = True
        db.commit()
        db.refresh(tenant)
        return CheckoutResponse(tenant=TenantOut.model_validate(tenant))

    if tenant.is_subscribed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This school is already on the unlimited plan.")

    _stripe()
    try:
        if tenant.stripe_customer_id:
            customer_id = tenant.stripe_customer_id
        else:
            customer = stripe.Customer.create(email=tenant.email, name=tenant.school_name, metadata={"tenant_id": tenant.id})
            tenant.stripe_customer_id = customer.id
            db.commit()
            customer_id = customer.id

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            client_reference_id=str(tenant.id),
            line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
            success_url=f"{settings.frontend_url}/settings?checkout=success",
            cancel_url=f"{settings.frontend_url}/settings?checkout=cancelled",
        )
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Couldn't start checkout with Stripe: {exc.user_message or str(exc)}",
        ) from exc

    return CheckoutResponse(checkout_url=session.url)


@router.post("/portal", response_model=PortalResponse)
def create_portal(tenant: Tenant = Depends(get_current_tenant)) -> PortalResponse:
    """Stripe's hosted page for a tenant to update payment details, see past
    invoices, or cancel - rather than us having to build any of that."""
    if not settings.stripe_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Billing management isn't available in demo mode (no Stripe account configured).",
        )
    if not tenant.stripe_customer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This school has no billing account yet.")

    _stripe()
    try:
        session = stripe.billing_portal.Session.create(
            customer=tenant.stripe_customer_id,
            return_url=f"{settings.frontend_url}/settings",
        )
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Couldn't open the billing portal: {exc.user_message or str(exc)}",
        ) from exc

    return PortalResponse(portal_url=session.url)


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    """Stripe calls this directly - no tenant auth here, the signature
    header (verified against STRIPE_WEBHOOK_SECRET) is what proves the
    request is genuinely from Stripe and not forged by a client."""
    if not settings.stripe_configured or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature") from exc

    data = event["data"]["object"]
    event_type = event["type"]

    if event_type == "checkout.session.completed":
        tenant = _find_tenant(db, client_reference_id=data.get("client_reference_id"), customer_id=data.get("customer"))
        if tenant is not None:
            tenant.is_subscribed = True
            tenant.stripe_customer_id = data.get("customer") or tenant.stripe_customer_id
            tenant.stripe_subscription_id = data.get("subscription")
            db.commit()

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        tenant = _find_tenant(db, customer_id=data.get("customer"))
        if tenant is not None:
            active = event_type == "customer.subscription.updated" and data.get("status") in ("active", "trialing")
            tenant.is_subscribed = active
            tenant.stripe_subscription_id = data.get("id") if active else None
            db.commit()

    return {"received": True}


def _find_tenant(db: Session, client_reference_id: str | None = None, customer_id: str | None = None) -> Tenant | None:
    if client_reference_id:
        tenant = db.get(Tenant, int(client_reference_id))
        if tenant is not None:
            return tenant
    if customer_id:
        return db.scalar(select(Tenant).where(Tenant.stripe_customer_id == customer_id))
    return None
