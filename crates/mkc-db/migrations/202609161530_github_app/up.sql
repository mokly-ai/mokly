CREATE TABLE github_installations (
    id uuid PRIMARY KEY,
    github_id bigint NOT NULL UNIQUE CHECK (github_id > 0),
    app_id bigint NOT NULL CHECK (app_id > 0),
    organization_id uuid UNIQUE REFERENCES organizations ON DELETE CASCADE,
    account_id bigint NOT NULL CHECK (account_id > 0),
    account_name text NOT NULL CHECK (length(account_name) > 0),
    account_kind text NOT NULL CHECK (account_kind IN ('user', 'organization')),
    manage_url text NOT NULL,
    active boolean NOT NULL,
    connected boolean NOT NULL,
    updated_at timestamptz NOT NULL,
    CHECK (NOT connected OR organization_id IS NOT NULL)
);

CREATE TABLE github_repositories (
    id uuid PRIMARY KEY,
    installation_id uuid NOT NULL REFERENCES github_installations ON DELETE CASCADE,
    github_id bigint NOT NULL CHECK (github_id > 0),
    full_name text NOT NULL,
    default_branch text NOT NULL,
    private boolean NOT NULL,
    active boolean NOT NULL,
    UNIQUE (installation_id, github_id)
);

CREATE TABLE github_project_repositories (
    project_id uuid PRIMARY KEY REFERENCES projects ON DELETE CASCADE,
    repository_id uuid NOT NULL REFERENCES github_repositories
);
CREATE INDEX github_project_repository ON github_project_repositories (repository_id);

CREATE TABLE github_webhook_deliveries (
    id uuid PRIMARY KEY,
    event text NOT NULL CHECK (event ~ '^[a-z_]{1,64}$'),
    body bytea NOT NULL CHECK (octet_length(body) <= 2097152),
    received_at timestamptz NOT NULL,
    due_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    status text NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'ignored', 'failed')),
    lease uuid,
    lease_until timestamptz,
    last_failure text CHECK (last_failure IN ('malformed', 'forbidden', 'unavailable', 'rate-limited', 'internal')),
    CHECK ((status = 'processing') = (lease IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX github_delivery_queue ON github_webhook_deliveries (due_at, received_at)
    WHERE status IN ('pending', 'processing');

CREATE TABLE github_user_identities (
    github_user_id bigint PRIMARY KEY CHECK (github_user_id > 0),
    user_id uuid NOT NULL UNIQUE REFERENCES users ON DELETE CASCADE,
    login text NOT NULL CHECK (length(login) > 0),
    created_at timestamptz NOT NULL
);

CREATE TABLE github_oauth_flows (
    state_hash text PRIMARY KEY CHECK (state_hash ~ '^[a-f0-9]{64}$'),
    verifier_hash text NOT NULL CHECK (verifier_hash ~ '^[a-f0-9]{64}$'),
    purpose text NOT NULL CHECK (purpose IN ('sign-in', 'connect', 'install')),
    user_id uuid REFERENCES users ON DELETE CASCADE,
    session_hash text CHECK (session_hash ~ '^[a-f0-9]{64}$'),
    organization_id uuid REFERENCES organizations ON DELETE CASCADE,
    installation_id bigint CHECK (installation_id > 0),
    return_to text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    CHECK ((purpose = 'sign-in' AND user_id IS NULL AND session_hash IS NULL AND organization_id IS NULL)
        OR (purpose = 'connect' AND user_id IS NOT NULL AND session_hash IS NOT NULL AND organization_id IS NULL)
        OR (purpose = 'install' AND user_id IS NOT NULL AND session_hash IS NOT NULL AND organization_id IS NOT NULL)),
    CHECK (installation_id IS NULL OR purpose = 'install')
);
CREATE INDEX github_flows_expiry ON github_oauth_flows (expires_at);

CREATE TABLE github_pull_requests (
    repository_id uuid NOT NULL REFERENCES github_repositories ON DELETE CASCADE,
    number bigint NOT NULL CHECK (number > 0),
    title text NOT NULL,
    open boolean NOT NULL,
    merged boolean NOT NULL,
    head_ref text NOT NULL,
    head_sha text NOT NULL,
    base_ref text NOT NULL,
    base_sha text NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (repository_id, number)
);

CREATE TABLE github_branches (
    repository_id uuid NOT NULL REFERENCES github_repositories ON DELETE CASCADE,
    name text NOT NULL,
    head_sha text,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (repository_id, name)
);

CREATE TABLE github_check_runs (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    repository_id uuid NOT NULL REFERENCES github_repositories,
    github_id bigint NOT NULL UNIQUE CHECK (github_id > 0),
    head_sha text NOT NULL,
    external_id text NOT NULL UNIQUE,
    rerequested boolean NOT NULL DEFAULT false
);
CREATE INDEX github_check_head ON github_check_runs (repository_id, head_sha);
