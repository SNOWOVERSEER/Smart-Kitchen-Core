"""Subscription management: Stripe checkout, portal, webhooks, vouchers."""

from datetime import datetime, timezone, timedelta

import stripe
from fastapi import HTTPException

from config import STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET, FRONTEND_URL
from database import get_supabase_admin_client


if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def get_subscription_status(user_id: str) -> dict:
    """Get full subscription status for the user."""
    supabase = get_supabase_admin_client()

    result = supabase.table("subscriptions").select("*").eq("user_id", user_id).limit(1).execute()
    sub = result.data[0] if result.data else None
    if not sub:
        sub = {"tier": "free", "prompt_credits": 0, "bonus_credits": 0,
               "trial_ends_at": None, "current_period_end": None}

    ai_result = (
        supabase.table("user_ai_configs")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    has_api_key = bool(ai_result.data)

    tier = sub["tier"]
    if has_api_key and tier != "supporter":
        tier = "byok"

    return {
        "tier": tier,
        "prompt_credits": sub["prompt_credits"],
        "bonus_credits": sub["bonus_credits"],
        "total_credits": sub["prompt_credits"] + sub["bonus_credits"],
        "has_api_key": has_api_key,
        "trial_ends_at": sub.get("trial_ends_at"),
        "current_period_end": sub.get("current_period_end"),
        "payment_failed": sub.get("payment_failed", False),
    }


def create_checkout_session(user_id: str, user_email: str, coupon_code: str | None = None) -> str:
    """Create a Stripe Checkout Session and return the URL."""
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    supabase = get_supabase_admin_client()

    result = supabase.table("subscriptions").select("stripe_customer_id").eq("user_id", user_id).limit(1).execute()
    sub = result.data[0] if result.data else None
    customer_id = sub.get("stripe_customer_id") if sub else None

    if not customer_id:
        customer = stripe.Customer.create(
            email=user_email,
            metadata={"user_id": user_id},
        )
        customer_id = customer.id
        supabase.table("subscriptions").update({
            "stripe_customer_id": customer_id,
        }).eq("user_id", user_id).execute()

    success_url = f"{FRONTEND_URL or 'http://localhost:5173'}/settings?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{FRONTEND_URL or 'http://localhost:5173'}/settings"

    params: dict = {
        "customer": customer_id,
        "mode": "subscription",
        "line_items": [{"price": STRIPE_PRICE_ID, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"user_id": user_id},
    }

    if coupon_code:
        v_result = (
            supabase.table("vouchers")
            .select("*")
            .eq("code", coupon_code)
            .eq("type", "discount")
            .limit(1)
            .execute()
        )
        if v_result.data:
            voucher = v_result.data[0]
            coupon_id = voucher.get("stripe_coupon_id")
            if not coupon_id:
                coupon = stripe.Coupon.create(
                    percent_off=voucher["value"],
                    duration="once",
                    name=f"Voucher {coupon_code}",
                )
                coupon_id = coupon.id
                supabase.table("vouchers").update({
                    "stripe_coupon_id": coupon_id,
                }).eq("id", voucher["id"]).execute()
            params["discounts"] = [{"coupon": coupon_id}]

    session = stripe.checkout.Session.create(**params)
    return session.url


def create_portal_session(user_id: str) -> str:
    """Create a Stripe Customer Portal session and return the URL."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    supabase = get_supabase_admin_client()
    result = supabase.table("subscriptions").select("stripe_customer_id").eq("user_id", user_id).limit(1).execute()
    sub = result.data[0] if result.data else None
    customer_id = sub.get("stripe_customer_id") if sub else None

    if not customer_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    return_url = f"{FRONTEND_URL or 'http://localhost:5173'}/settings"
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session.url


def handle_stripe_webhook(payload: bytes, sig_header: str) -> None:
    """Process Stripe webhook events."""
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    supabase = get_supabase_admin_client()
    event_type = event["type"]

    try:
        if event_type == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = session["metadata"].get("user_id")
            customer_id = session.get("customer")
            subscription_id = session.get("subscription")

            if user_id and subscription_id:
                sub_obj = stripe.Subscription.retrieve(subscription_id)
                supabase.table("subscriptions").update({
                    "tier": "supporter",
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": subscription_id,
                    "prompt_credits": 600,
                    "current_period_start": datetime.fromtimestamp(
                        sub_obj["current_period_start"], tz=timezone.utc
                    ).isoformat(),
                    "current_period_end": datetime.fromtimestamp(
                        sub_obj["current_period_end"], tz=timezone.utc
                    ).isoformat(),
                }).eq("user_id", user_id).execute()

        elif event_type == "invoice.paid":
            subscription_id = event["data"]["object"].get("subscription")
            if subscription_id:
                result = (
                    supabase.table("subscriptions")
                    .select("id, user_id")
                    .eq("stripe_subscription_id", subscription_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    sub = result.data[0]
                    sub_obj = stripe.Subscription.retrieve(subscription_id)
                    supabase.table("subscriptions").update({
                        "prompt_credits": 600,
                        "current_period_start": datetime.fromtimestamp(
                            sub_obj["current_period_start"], tz=timezone.utc
                        ).isoformat(),
                        "current_period_end": datetime.fromtimestamp(
                            sub_obj["current_period_end"], tz=timezone.utc
                        ).isoformat(),
                    }).eq("id", sub["id"]).execute()

        elif event_type == "customer.subscription.deleted":
            subscription_id = event["data"]["object"].get("id")
            if subscription_id:
                result = (
                    supabase.table("subscriptions")
                    .select("id")
                    .eq("stripe_subscription_id", subscription_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    supabase.table("subscriptions").update({
                        "tier": "free",
                        "prompt_credits": 0,
                        "stripe_subscription_id": None,
                        "current_period_start": None,
                        "current_period_end": None,
                    }).eq("id", result.data[0]["id"]).execute()

        elif event_type == "customer.subscription.updated":
            sub_obj = event["data"]["object"]
            subscription_id = sub_obj.get("id")
            if subscription_id:
                result = (
                    supabase.table("subscriptions")
                    .select("id")
                    .eq("stripe_subscription_id", subscription_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    updates: dict = {
                        "current_period_start": datetime.fromtimestamp(
                            sub_obj["current_period_start"], tz=timezone.utc
                        ).isoformat(),
                        "current_period_end": datetime.fromtimestamp(
                            sub_obj["current_period_end"], tz=timezone.utc
                        ).isoformat(),
                    }
                    status = sub_obj.get("status")
                    if status in ("past_due", "unpaid"):
                        updates["payment_failed"] = True
                    elif status == "active":
                        updates["payment_failed"] = False
                    supabase.table("subscriptions").update(updates).eq("id", result.data[0]["id"]).execute()

        elif event_type == "invoice.payment_failed":
            subscription_id = event["data"]["object"].get("subscription")
            if subscription_id:
                result = (
                    supabase.table("subscriptions")
                    .select("id")
                    .eq("stripe_subscription_id", subscription_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    supabase.table("subscriptions").update({
                        "payment_failed": True,
                    }).eq("id", result.data[0]["id"]).execute()

        else:
            print(f"[stripe-webhook] Unhandled event type: {event_type}")

    except Exception as e:
        print(f"[stripe-webhook] Error processing {event_type}: {e}")


def redeem_voucher(user_id: str, code: str) -> dict:
    """Redeem a voucher code. Returns type, value, and message."""
    supabase = get_supabase_admin_client()

    result = supabase.table("vouchers").select("*").eq("code", code).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Invalid voucher code")

    voucher = result.data[0]

    if voucher.get("expires_at"):
        expires = datetime.fromisoformat(voucher["expires_at"].replace("Z", "+00:00"))
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Voucher has expired")

    if voucher.get("max_uses") is not None and voucher["used_count"] >= voucher["max_uses"]:
        raise HTTPException(status_code=400, detail="Voucher has been fully redeemed")

    existing = (
        supabase.table("voucher_redemptions")
        .select("id")
        .eq("voucher_id", voucher["id"])
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="You have already redeemed this code")

    sub_result = supabase.table("subscriptions").select("*").eq("user_id", user_id).limit(1).execute()
    sub = sub_result.data[0] if sub_result.data else None
    if not sub:
        raise HTTPException(status_code=400, detail="No subscription found")

    v_type = voucher["type"]
    v_value = voucher["value"]

    if v_type == "credits":
        supabase.table("subscriptions").update({
            "bonus_credits": sub["bonus_credits"] + v_value,
        }).eq("id", sub["id"]).execute()
        message = f"Added {v_value} bonus credits!"

    elif v_type == "supporter_trial":
        total_credits = v_value * 20
        trial_end = datetime.now(timezone.utc) + timedelta(days=v_value)
        supabase.table("subscriptions").update({
            "prompt_credits": sub["prompt_credits"] + total_credits,
            "trial_ends_at": trial_end.isoformat(),
        }).eq("id", sub["id"]).execute()
        message = f"Activated {v_value}-day trial with {total_credits} credits!"

    elif v_type == "discount":
        message = f"Discount code ready! Use it at checkout for {v_value}% off."

    else:
        raise HTTPException(status_code=400, detail="Unknown voucher type")

    supabase.table("voucher_redemptions").insert({
        "voucher_id": voucher["id"],
        "user_id": user_id,
    }).execute()

    supabase.table("vouchers").update({
        "used_count": voucher["used_count"] + 1,
    }).eq("id", voucher["id"]).execute()

    return {"type": v_type, "value": v_value, "message": message}
