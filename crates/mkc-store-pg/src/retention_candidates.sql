SELECT * FROM (
    SELECT * FROM publications
    WHERE state IN ('uploading', 'validating') AND deadline <= $1
      AND ($3::uuid IS NULL OR id > $3)
    UNION ALL
    SELECT * FROM publications
    WHERE state = 'failed' AND created_at <= $2
      AND ($3::uuid IS NULL OR id > $3)
) AS eligible
ORDER BY id ASC
LIMIT $4
