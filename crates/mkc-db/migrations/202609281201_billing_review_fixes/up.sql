ALTER TABLE billing_customers
    ADD COLUMN checkout_pending_until timestamptz;

ALTER TABLE billing_subscriptions
    ADD COLUMN seats_checked_at timestamptz;

ALTER TABLE billing_deliveries
    DROP CONSTRAINT billing_deliveries_last_failure_check;
ALTER TABLE billing_deliveries
    ADD CONSTRAINT billing_deliveries_last_failure_check
    CHECK (last_failure IN ('malformed', 'conflict', 'unavailable', 'rate-limited', 'internal'));
