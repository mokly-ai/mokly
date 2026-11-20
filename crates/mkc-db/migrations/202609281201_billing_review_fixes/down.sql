ALTER TABLE billing_deliveries
    DROP CONSTRAINT billing_deliveries_last_failure_check;
UPDATE billing_deliveries
    SET last_failure = 'internal'
    WHERE last_failure = 'conflict';
ALTER TABLE billing_deliveries
    ADD CONSTRAINT billing_deliveries_last_failure_check
    CHECK (last_failure IN ('malformed', 'unavailable', 'rate-limited', 'internal'));

ALTER TABLE billing_subscriptions
    DROP COLUMN seats_checked_at;

ALTER TABLE billing_customers
    DROP COLUMN checkout_pending_until;
