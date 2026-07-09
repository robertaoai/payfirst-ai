-- Add unique constraint on payment_provider_id for upsert idempotency
-- This prevents duplicate purchase rows when Stripe fires the webhook twice
CREATE UNIQUE INDEX IF NOT EXISTS purchases_payment_provider_id_key
  ON purchases (payment_provider_id)
  WHERE payment_provider_id IS NOT NULL;
