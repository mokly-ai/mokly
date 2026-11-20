DROP TABLE billing_seat_commands;
DROP TABLE billing_checkout_sessions;

ALTER TABLE billing_subscription_items
    ADD COLUMN requested_quantity integer CHECK (requested_quantity >= 0),
    ADD COLUMN requested_at timestamptz,
    ADD COLUMN retry_at timestamptz;

ALTER TABLE billing_customers
    ADD COLUMN checkout_pending_until timestamptz;
