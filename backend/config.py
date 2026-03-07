"""Application configuration loaded from environment variables."""

import os


SUPABASE_URL: str = os.environ["SUPABASE_URL"]

# New API keys (recommended): sb_publishable_* and sb_secret_*
# Legacy keys (deprecated): anon JWT and service_role JWT
SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SECRET_KEY: str | None = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

# Fallback LLM for users without their own key
DEFAULT_OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")

FRONTEND_URL: str | None = os.getenv("FRONTEND_URL")

# Platform LLM key for Free/Supporter users
PLATFORM_API_KEY: str | None = os.getenv("PLATFORM_API_KEY") or DEFAULT_OPENAI_API_KEY
PLATFORM_MODEL: str = os.getenv("PLATFORM_MODEL", "gpt-4.1-mini")

# Stripe
STRIPE_SECRET_KEY: str | None = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET: str | None = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID: str | None = os.getenv("STRIPE_PRICE_ID")
