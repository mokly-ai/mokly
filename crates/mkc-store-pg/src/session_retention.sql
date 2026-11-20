DELETE FROM sessions WHERE token_hash IN (
    SELECT token_hash FROM sessions
    WHERE expires_at <= $1 OR last_seen_at <= $2
    ORDER BY expires_at, token_hash LIMIT $3
)
