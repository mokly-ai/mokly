UPDATE builds b SET state = 'running', attempt = attempt + 1, attempt_operation_id = $3,
    lease_token = $4, lease_expires_at = $5, deadline_at = $6, started_at = $2,
    step = NULL, log_bytes = 0, log_head_sequence = 0, log_elided_bytes = 0, log_complete = false
WHERE id = $1 AND state = 'queued' AND next_attempt_at <= $2 AND
    (SELECT count(*) FROM builds live JOIN projects lp ON lp.id = live.project_id
     WHERE lp.organization_id = (SELECT organization_id FROM projects WHERE id = b.project_id)
       AND live.state = 'running' AND live.lease_expires_at > $2) < 2
RETURNING b.*
