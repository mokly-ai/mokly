DELETE FROM auth_rate_limits WHERE key IN (
    SELECT key FROM auth_rate_limits
    WHERE resets_at <= $1 ORDER BY resets_at, key LIMIT $2
)
