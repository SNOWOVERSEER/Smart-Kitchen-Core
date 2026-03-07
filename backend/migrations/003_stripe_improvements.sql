-- Stripe improvements migration
-- Run in Supabase SQL editor

-- 1. Add stripe_coupon_id to vouchers table for coupon reuse
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS stripe_coupon_id TEXT;

-- 2. Add payment_failed flag to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT false;

-- 3. Atomic credit deduction RPC (prevents race conditions)
CREATE OR REPLACE FUNCTION deduct_one_credit(p_user_id UUID)
RETURNS TABLE(pool TEXT, remaining_prompt INT, remaining_bonus INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prompt INT;
  v_bonus INT;
  v_id BIGINT;
BEGIN
  SELECT s.id, s.prompt_credits, s.bonus_credits
    INTO v_id, v_prompt, v_bonus
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    LIMIT 1
    FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'no_subscription';
  END IF;

  IF v_prompt > 0 THEN
    UPDATE subscriptions SET prompt_credits = prompt_credits - 1 WHERE id = v_id;
    RETURN QUERY SELECT 'prompt'::TEXT, v_prompt - 1, v_bonus;
  ELSIF v_bonus > 0 THEN
    UPDATE subscriptions SET bonus_credits = bonus_credits - 1 WHERE id = v_id;
    RETURN QUERY SELECT 'bonus'::TEXT, v_prompt, v_bonus - 1;
  ELSE
    RAISE EXCEPTION 'no_credits';
  END IF;
END;
$$;
