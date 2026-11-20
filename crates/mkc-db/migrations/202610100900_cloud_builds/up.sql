ALTER TABLE projects ADD COLUMN automatic_builds boolean NOT NULL DEFAULT false;

CREATE TABLE builds (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    repository_id uuid NOT NULL REFERENCES github_repositories(id),
    trigger text NOT NULL CHECK (trigger IN ('push', 'pull-request', 'setup', 'request', 'rerun')),
    branch text NOT NULL CHECK (octet_length(branch) BETWEEN 1 AND 255 AND branch !~ '[[:cntrl:]]'),
    head_sha text NOT NULL CHECK (head_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'),
    pull_request bigint CHECK (pull_request > 0 AND pull_request <= 9007199254740991),
    base_ref text CHECK (octet_length(base_ref) BETWEEN 1 AND 255 AND base_ref !~ '[[:cntrl:]]'),
    config_path text NOT NULL CHECK (octet_length(config_path) BETWEEN 1 AND 1024),
    state text NOT NULL CHECK (state IN ('queued', 'running', 'published', 'failed', 'timed-out', 'superseded', 'cancelled')),
    step text CHECK (step IN ('checkout', 'install', 'publish')),
    attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
    next_attempt_at timestamptz NOT NULL,
    attempt_operation_id uuid,
    lease_token uuid,
    lease_expires_at timestamptz,
    deadline_at timestamptz,
    failure_cause text CHECK (failure_cause IN ('exit', 'upload-rejected', 'unsupported-lockfile', 'unsupported-mokly-version', 'uncommitted-changes', 'stale-generated-output', 'output-limit', 'deadline', 'idle', 'plan-required', 'infrastructure', 'repository-unavailable')),
    exit_code integer,
    publication_id uuid REFERENCES publications(id) ON DELETE SET NULL,
    superseded_by uuid REFERENCES builds(id) ON DELETE SET NULL,
    log_bytes bigint NOT NULL DEFAULT 0 CHECK (log_bytes BETWEEN 0 AND 1048576),
    log_head_sequence bigint NOT NULL DEFAULT 0 CHECK (log_head_sequence >= 0),
    log_sequence bigint NOT NULL DEFAULT 0 CHECK (log_sequence >= log_head_sequence),
    log_elided_bytes bigint NOT NULL DEFAULT 0 CHECK (log_elided_bytes >= 0),
    log_complete boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    started_at timestamptz,
    finished_at timestamptz,
    CHECK (CASE WHEN state = 'running' THEN lease_token IS NOT NULL AND lease_expires_at IS NOT NULL
        AND deadline_at IS NOT NULL AND attempt_operation_id IS NOT NULL AND attempt > 0 AND started_at IS NOT NULL
        ELSE lease_token IS NULL AND lease_expires_at IS NULL END),
    CHECK ((state NOT IN ('queued', 'running')) = (finished_at IS NOT NULL)),
    CHECK ((state IN ('failed', 'timed-out')) = (failure_cause IS NOT NULL)),
    CHECK (failure_cause IS NULL OR (state = 'timed-out') = (failure_cause IN ('deadline', 'idle'))),
    CHECK (exit_code IS NULL OR state = 'failed'),
    CHECK (state <> 'published' OR publication_id IS NOT NULL),
    CHECK (superseded_by IS NULL OR (state = 'superseded' AND superseded_by <> id)),
    CHECK (finished_at IS NULL OR finished_at >= created_at),
    CHECK (deadline_at IS NULL OR (started_at IS NOT NULL AND deadline_at > started_at))
);
CREATE UNIQUE INDEX builds_active_head ON builds(project_id, head_sha) WHERE state IN ('queued', 'running');
CREATE INDEX builds_claim ON builds(next_attempt_at, created_at, id) WHERE state = 'queued';
CREATE INDEX builds_lease ON builds(lease_expires_at, next_attempt_at, created_at, id) WHERE state = 'running';
CREATE INDEX builds_project_lease ON builds(project_id, lease_expires_at) WHERE state = 'running';
CREATE INDEX builds_branch ON builds(project_id, branch, created_at DESC, id DESC);
CREATE INDEX builds_pull_request ON builds(project_id, pull_request, created_at DESC, id DESC) WHERE pull_request IS NOT NULL;
CREATE INDEX builds_retention ON builds(finished_at, id) WHERE finished_at IS NOT NULL;
CREATE INDEX builds_publication ON builds(publication_id) WHERE publication_id IS NOT NULL;
CREATE INDEX builds_repository ON builds(repository_id);
CREATE INDEX builds_superseded_by ON builds(superseded_by) WHERE superseded_by IS NOT NULL;

ALTER TABLE publications ADD COLUMN build_id uuid REFERENCES builds(id) ON DELETE SET NULL;
ALTER TABLE publications ADD COLUMN build_failure_event_id uuid UNIQUE;
ALTER TABLE publications ADD CONSTRAINT publications_build_event
    CHECK (build_id IS NULL OR build_failure_event_id IS NOT NULL);
CREATE INDEX publications_build ON publications(build_id, state, id) WHERE build_id IS NOT NULL;

CREATE TABLE build_upload_grants (
    id uuid PRIMARY KEY,
    build_id uuid NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    attempt integer NOT NULL CHECK (attempt > 0),
    token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest) = 32),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    outcome text CHECK (outcome IN ('accepted', 'rejected', 'plan-required', 'unavailable')),
    created_at timestamptz NOT NULL,
    UNIQUE (build_id, attempt),
    CHECK (expires_at > created_at),
    CHECK (consumed_at IS NULL OR (outcome IS NOT NULL AND outcome = 'accepted'))
);
CREATE INDEX build_upload_grants_expiry ON build_upload_grants(expires_at);

CREATE TABLE build_log_chunks (
    build_id uuid NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    sequence bigint NOT NULL CHECK (sequence > 0),
    attempt integer NOT NULL CHECK (attempt > 0),
    step text CHECK (step IN ('checkout', 'install', 'publish')),
    stream text NOT NULL CHECK (stream IN ('stdout', 'stderr', 'system')),
    bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 65536),
    created_at timestamptz NOT NULL,
    PRIMARY KEY (build_id, sequence)
);

CREATE TABLE build_checks (
    build_id uuid PRIMARY KEY REFERENCES builds(id) ON DELETE CASCADE,
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    delivered_version bigint NOT NULL DEFAULT 0 CHECK (delivered_version >= 0 AND delivered_version <= version),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    permanent_failures integer NOT NULL DEFAULT 0 CHECK (permanent_failures BETWEEN 0 AND 5),
    next_attempt_at timestamptz NOT NULL,
    dead_lettered_at timestamptz,
    claim_expires_at timestamptz
);
CREATE INDEX build_checks_pending ON build_checks(next_attempt_at, build_id)
    WHERE delivered_version < version AND dead_lettered_at IS NULL;
CREATE INDEX build_checks_dead_letters ON build_checks(build_id)
    WHERE delivered_version < version AND dead_lettered_at IS NOT NULL;
