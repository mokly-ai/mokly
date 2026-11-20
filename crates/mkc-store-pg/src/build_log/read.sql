WITH log_window AS (
    SELECT c.*, sum(octet_length(bytes)) OVER (ORDER BY sequence) AS size,
           row_number() OVER (ORDER BY sequence) AS position
    FROM build_log_chunks c WHERE build_id = $2 AND sequence > $3
    ORDER BY sequence LIMIT $4
)
SELECT b.log_complete AND b.state NOT IN ('queued', 'running') AS terminal_complete,
       b.log_head_sequence, b.log_elided_bytes,
       (SELECT max(sequence) FROM build_log_chunks WHERE build_id = b.id) AS last_sequence,
       w.sequence, w.attempt, w.step, w.stream, w.bytes, w.created_at
FROM builds b LEFT JOIN log_window w ON (w.size <= 262144 OR w.position = 1)
WHERE b.id = $2 AND b.project_id = $1
ORDER BY w.sequence
