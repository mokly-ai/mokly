WITH candidates AS (
    SELECT id FROM builds
    WHERE project_id = $1 AND id <> $2 AND head_sha <> $3
      AND (($4::bigint IS NOT NULL AND pull_request = $4)
        OR ($4::bigint IS NULL AND pull_request IS NULL AND branch = $5))
      AND $6 <> 'rerun' AND state IN ('queued', 'running') AND publication_id IS NULL
    ORDER BY id FOR UPDATE
), changed AS (
    UPDATE builds SET state = 'superseded', superseded_by = $2, finished_at = $7,
        lease_token = NULL, lease_expires_at = NULL, log_complete = true
    WHERE id IN (SELECT id FROM candidates) AND state IN ('queued', 'running') AND publication_id IS NULL
    RETURNING id, started_at
), checked AS (
    INSERT INTO build_checks (build_id, next_attempt_at)
    SELECT id, $7 FROM changed
    ON CONFLICT (build_id) DO UPDATE SET version = build_checks.version + 1,
    next_attempt_at = EXCLUDED.next_attempt_at, dead_lettered_at = NULL, permanent_failures = 0
    RETURNING build_id
)
SELECT id, started_at FROM changed ORDER BY id
