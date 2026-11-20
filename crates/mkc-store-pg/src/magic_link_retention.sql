DELETE FROM magic_links WHERE token_hash IN (
    SELECT token_hash FROM magic_links
    WHERE expires_at <= $1 ORDER BY expires_at, token_hash LIMIT $2
)
