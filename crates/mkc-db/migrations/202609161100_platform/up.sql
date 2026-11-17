CREATE TABLE users (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamptz NOT NULL
);
CREATE TABLE organizations (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    version bigint NOT NULL CHECK (version > 0),
    created_at timestamptz NOT NULL,
    kind text NOT NULL DEFAULT 'personal' CHECK (kind = 'personal'),
    plan text NOT NULL DEFAULT 'free' CHECK (plan = 'free')
);
CREATE TABLE integrations (
    subject_kind text NOT NULL CHECK (subject_kind IN ('user', 'organization')),
    subject_id uuid NOT NULL,
    provider text NOT NULL CHECK (provider = 'github'),
    account_name text NOT NULL CHECK (length(btrim(account_name)) > 0),
    created_at timestamptz NOT NULL,
    user_id uuid GENERATED ALWAYS AS
        (CASE WHEN subject_kind = 'user' THEN subject_id END) STORED REFERENCES users ON DELETE CASCADE,
    organization_id uuid GENERATED ALWAYS AS
        (CASE WHEN subject_kind = 'organization' THEN subject_id END) STORED REFERENCES organizations ON DELETE CASCADE,
    PRIMARY KEY (subject_kind, subject_id)
);
CREATE TABLE memberships (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
    user_id uuid REFERENCES users ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner','admin','member','reviewer')),
    version bigint NOT NULL CHECK (version > 0),
    expires_at timestamptz,
    UNIQUE (organization_id, email),
    UNIQUE (organization_id, user_id),
    CHECK ((user_id IS NULL AND expires_at IS NOT NULL AND role <> 'owner') OR
           (user_id IS NOT NULL AND expires_at IS NULL))
);
CREATE TABLE projects (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
    name text NOT NULL,
    repository text NOT NULL,
    config_path text NOT NULL,
    visibility text NOT NULL CHECK (visibility IN ('private','public')),
    require_approval boolean NOT NULL DEFAULT false,
    version bigint NOT NULL CHECK (version > 0),
    UNIQUE (organization_id, repository, config_path)
);
CREATE TABLE project_grants (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin','member','reviewer')),
    version bigint NOT NULL CHECK (version > 0),
    UNIQUE (project_id, user_id)
);
CREATE TABLE project_tokens (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name text NOT NULL,
    prefix text NOT NULL,
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL,
    last_used_at timestamptz,
    revoked_at timestamptz
);
CREATE TABLE magic_links (
    token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    email text NOT NULL,
    return_to text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz
);
CREATE TABLE sessions (
    token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    csrf_token text NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL
);
CREATE TABLE auth_rate_limits (
    key text PRIMARY KEY,
    count bigint NOT NULL CHECK (count > 0),
    resets_at timestamptz NOT NULL
);
CREATE INDEX memberships_user ON memberships (user_id);
CREATE INDEX projects_organization ON projects (organization_id);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX magic_links_expiry ON magic_links (expires_at);
