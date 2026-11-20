CREATE TABLE desktop_grants (
    token_hash TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    return_to TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    session_expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX desktop_grants_expiry ON desktop_grants (expires_at);
CREATE INDEX desktop_grants_user ON desktop_grants (user_id);
