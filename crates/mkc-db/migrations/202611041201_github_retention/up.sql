CREATE INDEX github_delivery_retention
    ON github_webhook_deliveries(received_at, id)
    WHERE status IN ('done', 'ignored', 'failed');
