CREATE FUNCTION mkc_build_live_notice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM mkc_live_notice(NEW.project_id, 'build', NEW.id, NEW.log_sequence);
    RETURN NULL;
END;
$$;

CREATE TRIGGER builds_live_notice_insert
AFTER INSERT ON builds
FOR EACH ROW EXECUTE FUNCTION mkc_build_live_notice();

CREATE TRIGGER builds_live_notice_update
AFTER UPDATE ON builds
FOR EACH ROW
WHEN (
    ROW(OLD.id, OLD.project_id, OLD.state, OLD.trigger, OLD.branch, OLD.head_sha,
        OLD.pull_request, OLD.base_ref, OLD.step, OLD.created_at, OLD.started_at,
        OLD.finished_at, OLD.attempt, OLD.failure_cause, OLD.exit_code,
        OLD.publication_id, OLD.superseded_by, OLD.log_complete)
    IS DISTINCT FROM
    ROW(NEW.id, NEW.project_id, NEW.state, NEW.trigger, NEW.branch, NEW.head_sha,
        NEW.pull_request, NEW.base_ref, NEW.step, NEW.created_at, NEW.started_at,
        NEW.finished_at, NEW.attempt, NEW.failure_cause, NEW.exit_code,
        NEW.publication_id, NEW.superseded_by, NEW.log_complete)
    OR (NEW.pull_request IS NOT NULL AND OLD.repository_id IS DISTINCT FROM NEW.repository_id)
)
EXECUTE FUNCTION mkc_build_live_notice();

CREATE FUNCTION mkc_build_log_live_notice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM mkc_live_notice(builds.project_id, 'build-log', NEW.build_id, NEW.sequence)
    FROM builds WHERE builds.id = NEW.build_id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER build_log_chunks_live_notice_insert
AFTER INSERT ON build_log_chunks
FOR EACH ROW EXECUTE FUNCTION mkc_build_log_live_notice();
