SELECT b.* FROM builds b JOIN projects p ON p.id = b.project_id
WHERE p.organization_id = $2 AND ($3::uuid IS NULL OR b.id = $3) AND
    ((b.state = 'queued' AND b.next_attempt_at <= $1 AND
      (SELECT count(*) FROM builds live JOIN projects lp ON lp.id = live.project_id
       WHERE lp.organization_id = $2 AND live.state = 'running' AND live.lease_expires_at > $1) < 2)
     OR (b.state = 'running' AND b.lease_expires_at <= $1))
ORDER BY b.next_attempt_at, b.created_at, b.id
FOR UPDATE OF b SKIP LOCKED LIMIT 1
