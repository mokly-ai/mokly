LOCK TABLE builds IN ACCESS EXCLUSIVE MODE;

CREATE TABLE legacy_build_failures (
    build_id uuid PRIMARY KEY REFERENCES builds(id) ON DELETE CASCADE
);

INSERT INTO legacy_build_failures (build_id)
SELECT id FROM builds WHERE failure_cause = 'stale-generated-output';

UPDATE builds SET failure_cause = 'exit'
WHERE failure_cause = 'stale-generated-output';

ALTER TABLE builds DROP CONSTRAINT builds_failure_cause_check;
ALTER TABLE builds ADD CONSTRAINT builds_failure_cause_check
    CHECK (failure_cause IN (
        'exit', 'upload-rejected', 'unsupported-lockfile', 'unsupported-mokly-version',
        'uncommitted-changes', 'output-limit', 'deadline', 'idle', 'plan-required',
        'infrastructure', 'repository-unavailable'
    ));
