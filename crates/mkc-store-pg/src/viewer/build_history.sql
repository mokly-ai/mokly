WITH entries AS (
    SELECT id, created_at, 'publication'::text AS kind FROM publications
    WHERE project_id = $1 AND ($2::text IS NULL OR branch = $2)
      AND ($3::bigint IS NULL OR pull_request = $3)
      AND NOT (build_id IS NOT NULL AND state IN ('uploading', 'validating', 'failed'))
      AND (state <> 'failed' OR failure_code IS DISTINCT FROM 'superseded')
    UNION ALL
    SELECT id, created_at, 'build'::text AS kind FROM builds
    WHERE $7 AND project_id = $1 AND ($2::text IS NULL OR branch = $2)
      AND ($3::bigint IS NULL OR pull_request = $3)
      AND state IN ('queued', 'running', 'failed', 'timed-out') AND publication_id IS NULL
), page AS (
    SELECT * FROM entries WHERE $4::timestamptz IS NULL OR (created_at, id) < ($4, $5)
    ORDER BY created_at DESC, id DESC LIMIT $6
)
SELECT p.*, b.id AS history_build_id,
       b.project_id AS history_build_project_id,
       b.repository_id AS history_build_repository_id,
       b.trigger AS history_build_trigger,
       b.branch AS history_build_branch,
       b.head_sha AS history_build_head_sha,
       b.pull_request AS history_build_pull_request,
       b.base_ref AS history_build_base_ref,
       b.config_path AS history_build_config_path,
       b.state AS history_build_state,
       b.step AS history_build_step,
       b.attempt AS history_build_attempt,
       b.next_attempt_at AS history_build_next_attempt_at,
       b.attempt_operation_id AS history_build_attempt_operation_id,
       b.lease_token AS history_build_lease_token,
       b.lease_expires_at AS history_build_lease_expires_at,
       b.deadline_at AS history_build_deadline_at,
       b.failure_cause AS history_build_failure_cause,
       b.exit_code AS history_build_exit_code,
       b.publication_id AS history_build_publication_id,
       b.superseded_by AS history_build_superseded_by,
       b.log_bytes AS history_build_log_bytes,
       b.log_head_sequence AS history_build_log_head_sequence,
       b.log_sequence AS history_build_log_sequence,
       b.log_elided_bytes AS history_build_log_elided_bytes,
       b.log_complete AS history_build_log_complete,
       b.created_at AS history_build_created_at,
       b.started_at AS history_build_started_at,
       b.finished_at AS history_build_finished_at,
       pr.number AS origin_number, pr.title AS origin_title, pr.author AS origin_author,
       CASE WHEN pr.number IS NOT NULL THEN r.full_name END AS origin_repository
FROM page e
LEFT JOIN publications p ON e.kind = 'publication' AND p.id = e.id
LEFT JOIN builds b ON e.kind = 'build' AND b.id = e.id
LEFT JOIN github_project_repositories binding ON binding.project_id = p.project_id
LEFT JOIN github_repositories r ON r.id = COALESCE(b.repository_id, binding.repository_id)
LEFT JOIN github_pull_requests pr ON pr.repository_id = r.id AND pr.number = COALESCE(b.pull_request, p.pull_request)
ORDER BY e.created_at DESC, e.id DESC
