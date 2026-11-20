ALTER TABLE billing_subscription_items
    ADD COLUMN retry_at timestamptz;
