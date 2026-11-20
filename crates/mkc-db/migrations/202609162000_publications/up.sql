CREATE TABLE publications (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch text,
    head_sha text CHECK (head_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'),
    base_ref text,
    base_sha text,
    pull_request bigint CHECK (pull_request > 0 AND pull_request <= 9007199254740991),
    config_path text,
    exported_at timestamptz,
    comparison_path text,
    state text NOT NULL CHECK (state IN ('uploading', 'validating', 'ready', 'failed', 'expired')),
    failure_code text CHECK (failure_code IN ('invalid-bundle', 'unsupported-version', 'too-large', 'unauthorized', 'internal', 'expired', 'superseded')),
    created_at timestamptz NOT NULL,
    deadline timestamptz NOT NULL CHECK (deadline > created_at),
    expired_at timestamptz,
    changes_state text CHECK (changes_state IN ('available', 'no-comparison')),
    changes_added bigint CHECK (changes_added >= 0),
    changes_changed bigint CHECK (changes_changed >= 0),
    changes_removed bigint CHECK (changes_removed >= 0),
    CHECK ((state IN ('ready', 'expired')) = (changes_state IS NOT NULL)),
    CHECK (CASE WHEN changes_state = 'available' THEN
        changes_added IS NOT NULL AND changes_changed IS NOT NULL AND changes_removed IS NOT NULL
        ELSE changes_added IS NULL AND changes_changed IS NULL AND changes_removed IS NULL END),
    CHECK (changes_state IS NULL OR (changes_state = 'no-comparison') = (comparison_path IS NULL)),
    CHECK ((state = 'failed') = (failure_code IS NOT NULL)),
    CHECK ((state = 'expired') = (expired_at IS NOT NULL)),
    CHECK ((head_sha IS NULL AND branch IS NULL AND config_path IS NULL AND exported_at IS NULL)
        OR (head_sha IS NOT NULL AND branch IS NOT NULL AND config_path IS NOT NULL AND exported_at IS NOT NULL)),
    CHECK (state NOT IN ('validating', 'ready', 'expired') OR head_sha IS NOT NULL),
    CHECK ((base_ref IS NULL AND base_sha IS NULL AND comparison_path IS NULL)
        OR (base_ref IS NOT NULL AND base_sha IS NOT NULL AND comparison_path IS NOT NULL))
);
CREATE UNIQUE INDEX publications_ready_identity ON publications(project_id, head_sha, config_path) WHERE state = 'ready' AND expired_at IS NULL;
CREATE INDEX publications_project_branch ON publications(project_id, branch, created_at DESC, id DESC) WHERE state = 'ready' AND expired_at IS NULL;
CREATE INDEX publications_retention ON publications(id) WHERE state <> 'expired';

CREATE FUNCTION publication_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id <> OLD.id OR NEW.project_id <> OLD.project_id
        OR NEW.created_at <> OLD.created_at OR NEW.deadline <> OLD.deadline
        OR (OLD.head_sha IS NOT NULL AND
            ROW(NEW.branch, NEW.head_sha, NEW.base_ref, NEW.base_sha, NEW.pull_request, NEW.config_path, NEW.exported_at, NEW.comparison_path)
            IS DISTINCT FROM
            ROW(OLD.branch, OLD.head_sha, OLD.base_ref, OLD.base_sha, OLD.pull_request, OLD.config_path, OLD.exported_at, OLD.comparison_path))
        OR NOT (NEW.state = OLD.state
            OR (OLD.state = 'uploading' AND NEW.state IN ('validating', 'failed'))
            OR (OLD.state = 'validating' AND NEW.state IN ('ready', 'failed'))
            OR (OLD.state = 'ready' AND NEW.state = 'expired'))
        OR (OLD.changes_state IS NOT NULL AND
            ROW(NEW.changes_state, NEW.changes_added, NEW.changes_changed, NEW.changes_removed)
            IS DISTINCT FROM
            ROW(OLD.changes_state, OLD.changes_added, OLD.changes_changed, OLD.changes_removed))
        OR (OLD.expired_at IS NOT NULL AND NEW.expired_at IS DISTINCT FROM OLD.expired_at)
    THEN
        RAISE EXCEPTION 'immutable publication or invalid transition';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER publication_immutable BEFORE UPDATE ON publications FOR EACH ROW EXECUTE FUNCTION publication_immutable();

CREATE TABLE publication_screen_views (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    publication_id uuid NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    screen_id text NOT NULL,
    screen_hash bytea NOT NULL,
    viewport text NOT NULL CHECK (viewport IN ('desktop', 'mobile')),
    scheme text NOT NULL CHECK (scheme IN ('light', 'dark'))
);
CREATE INDEX publication_screen_lookup ON publication_screen_views(publication_id, screen_hash);
CREATE FUNCTION publication_screen_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR NOT EXISTS (
        SELECT 1 FROM publications WHERE id = NEW.publication_id
        AND state = 'validating' AND comparison_path IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'screen selection requires validating comparison';
    END IF;
    NEW.screen_hash := sha256(convert_to(NEW.screen_id, 'UTF8'));
    RETURN NEW;
END;
$$;
CREATE TRIGGER publication_screen_immutable BEFORE INSERT OR UPDATE ON publication_screen_views
FOR EACH ROW EXECUTE FUNCTION publication_screen_immutable();

CREATE TABLE blobs (
    hash text PRIMARY KEY CHECK (hash ~ '^[0-9a-f]{64}$'),
    incarnation uuid NOT NULL,
    size bigint NOT NULL CHECK (size >= 0 AND size <= 67108864),
    content_type text NOT NULL,
    ref_count bigint NOT NULL DEFAULT 0 CHECK (ref_count >= 0),
    deleting boolean NOT NULL DEFAULT false,
    unreferenced_at timestamptz,
    CHECK ((ref_count = 0) = (unreferenced_at IS NOT NULL)),
    CHECK (NOT deleting OR ref_count = 0)
);
CREATE TABLE publication_files (
    publication_id uuid NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    path text NOT NULL CHECK (octet_length(path) BETWEEN 1 AND 1024),
    blob_hash text NOT NULL REFERENCES blobs(hash),
    content_type text NOT NULL,
    PRIMARY KEY (publication_id, path)
);
CREATE INDEX publication_files_hash ON publication_files(blob_hash);

CREATE FUNCTION publication_file_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (SELECT 1 FROM publications WHERE id = NEW.publication_id AND state = 'validating') THEN
            RAISE EXCEPTION 'file reservation requires validating publication';
        END IF;
        UPDATE blobs SET ref_count = ref_count + 1, unreferenced_at = NULL
        WHERE hash = NEW.blob_hash AND NOT deleting;
        IF NOT FOUND THEN RAISE EXCEPTION 'blob is unavailable for reservation'; END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'publication file references are immutable';
    ELSE
        UPDATE blobs SET ref_count = ref_count - 1,
            unreferenced_at = CASE WHEN ref_count = 1 THEN clock_timestamp() ELSE NULL END
        WHERE hash = OLD.blob_hash;
        RETURN OLD;
    END IF;
END;
$$;
CREATE TRIGGER publication_file_reference AFTER INSERT OR UPDATE OR DELETE ON publication_files FOR EACH ROW EXECUTE FUNCTION publication_file_reference();

CREATE TABLE publication_events (
    id uuid PRIMARY KEY,
    publication_id uuid NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('uploading', 'validating', 'ready', 'failed', 'expired', 'rerequest')),
    created_at timestamptz NOT NULL,
    delivered_at timestamptz,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    permanent_failures integer NOT NULL DEFAULT 0 CHECK (permanent_failures BETWEEN 0 AND 5),
    next_attempt_at timestamptz NOT NULL,
    dead_lettered_at timestamptz
);
CREATE INDEX publication_events_pending ON publication_events(next_attempt_at, id) WHERE delivered_at IS NULL AND dead_lettered_at IS NULL AND kind IN ('ready', 'failed', 'rerequest');

CREATE TABLE publication_branch_aliases (
    alias text PRIMARY KEY CHECK (alias ~ '^b-[0-9a-f]{40}$'),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch text NOT NULL,
    UNIQUE(project_id, branch)
);
CREATE TABLE catalogue_grants (
    digest text PRIMARY KEY CHECK (digest ~ '^[0-9a-f]{64}$'),
    publication_id uuid NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
CREATE INDEX catalogue_grants_expiry ON catalogue_grants(expires_at);
