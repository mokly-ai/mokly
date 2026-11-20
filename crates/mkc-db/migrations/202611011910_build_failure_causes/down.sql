LOCK TABLE builds IN ACCESS EXCLUSIVE MODE;

ALTER TABLE builds DROP CONSTRAINT builds_failure_cause_check;
ALTER TABLE builds ADD CONSTRAINT builds_failure_cause_check
    CHECK (failure_cause IN (
        'exit', 'upload-rejected', 'unsupported-lockfile', 'unsupported-mokly-version',
        'uncommitted-changes', 'stale-generated-output', 'output-limit', 'deadline',
        'idle', 'plan-required', 'infrastructure', 'repository-unavailable'
    ));

UPDATE builds SET failure_cause = 'stale-generated-output'
FROM legacy_build_failures
WHERE builds.id = legacy_build_failures.build_id
    AND builds.failure_cause = 'exit';

DROP TABLE legacy_build_failures;
