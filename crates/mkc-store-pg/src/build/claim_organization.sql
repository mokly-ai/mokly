SELECT o.id FROM organizations o
JOIN LATERAL (
    SELECT b.next_attempt_at, b.created_at, b.id FROM builds b
    JOIN projects p ON p.id = b.project_id
    WHERE p.organization_id = o.id AND
      ((b.state = 'queued' AND b.next_attempt_at <= $1 AND
        (SELECT count(*) FROM builds live JOIN projects lp ON lp.id = live.project_id
         WHERE lp.organization_id = o.id AND live.state = 'running' AND live.lease_expires_at > $1) < 2)
       OR (b.state = 'running' AND b.lease_expires_at <= $1))
    ORDER BY b.next_attempt_at, b.created_at, b.id LIMIT 1
) candidate ON true
ORDER BY candidate.next_attempt_at, candidate.created_at, candidate.id
FOR UPDATE OF o SKIP LOCKED LIMIT 1
