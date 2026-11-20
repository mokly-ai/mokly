DELETE FROM github_oauth_flows WHERE state_hash IN (
    SELECT state_hash FROM github_oauth_flows
    WHERE expires_at <= $1 ORDER BY expires_at, state_hash LIMIT $2
)
