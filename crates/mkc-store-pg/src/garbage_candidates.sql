SELECT * FROM (
    SELECT * FROM blobs
    WHERE ref_count = 0 AND deleting
    UNION ALL
    SELECT * FROM blobs
    WHERE ref_count = 0 AND NOT deleting AND unreferenced_at <= $1
) AS eligible
ORDER BY project_id ASC, hash COLLATE "C" ASC
LIMIT $2
