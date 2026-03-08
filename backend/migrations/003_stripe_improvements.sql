-- Stripe improvements migration
-- Run in Supabase SQL editor

-- 1. Add stripe_coupon_id to vouchers table for coupon reuse
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS stripe_coupon_id TEXT;

-- 2. Add payment_failed flag to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT false;
