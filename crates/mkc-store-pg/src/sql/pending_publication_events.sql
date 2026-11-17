SELECT e.id, e.publication_id, e.kind, e.created_at,
       e.attempts, e.permanent_failures
FROM publication_events e
JOIN publications p ON p.id = e.publication_id
WHERE e.delivered_at IS NULL
  AND e.dead_lettered_at IS NULL
  AND e.next_attempt_at <= $1
  AND e.kind IN ('ready', 'failed', 'rerequest')
  AND ($3::uuid IS NULL OR p.project_id = $3)
ORDER BY e.id ASC
LIMIT $2
