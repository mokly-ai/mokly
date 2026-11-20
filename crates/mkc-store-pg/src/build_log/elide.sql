WITH tail AS (
    SELECT sequence, sum(octet_length(bytes)) OVER (ORDER BY sequence DESC) AS size
    FROM build_log_chunks WHERE build_id = $1 AND sequence > $2
), deleted AS (
    DELETE FROM build_log_chunks WHERE build_id = $1 AND sequence IN (
        SELECT sequence FROM tail WHERE size > 786432
    ) RETURNING bytes
)
SELECT COALESCE(sum(octet_length(bytes)), 0)::bigint AS bytes FROM deleted
