DELETE FROM github_webhook_deliveries WHERE id IN (
    SELECT id FROM github_webhook_deliveries
    WHERE received_at <= $1 AND status IN ('done', 'ignored', 'failed')
    ORDER BY received_at, id LIMIT $2
)
