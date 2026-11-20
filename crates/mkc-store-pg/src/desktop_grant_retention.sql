DELETE FROM desktop_grants WHERE token_hash IN (
    SELECT token_hash FROM desktop_grants
    WHERE expires_at <= $1 ORDER BY expires_at, token_hash LIMIT $2
)
