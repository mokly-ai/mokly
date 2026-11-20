WITH repository AS (
    SELECT r.default_branch, r.id FROM github_repositories r
    JOIN github_project_repositories p ON p.repository_id = r.id
    WHERE p.project_id = $1
), default_branch AS (
    SELECT COALESCE(
        NULLIF((SELECT default_branch FROM repository), ''),
        (SELECT branch FROM publications WHERE project_id = $1
         AND state = 'ready' AND expired_at IS NULL
         ORDER BY created_at DESC, id DESC LIMIT 1)
    ) AS name
), observations AS (
    SELECT name, updated_at FROM github_branches
    WHERE repository_id = (SELECT id FROM repository)
      AND (head_sha IS NOT NULL OR EXISTS (
          SELECT 1 FROM publications WHERE project_id = $1 AND branch = github_branches.name
      ) OR EXISTS (SELECT 1 FROM builds WHERE project_id = $1 AND branch = github_branches.name))
    UNION ALL
    SELECT branch, created_at FROM publications
    WHERE project_id = $1 AND branch IS NOT NULL
    UNION ALL
    SELECT branch, created_at FROM builds WHERE project_id = $1
), branches AS (
    SELECT name, max(updated_at) AS updated_at,
           COALESCE(name = (SELECT name FROM default_branch), false) AS is_default
    FROM observations GROUP BY name
)
SELECT b.name, b.updated_at, b.is_default,
    newest_build.id AS newest_build_id, newest_build.state AS newest_build_state,
    newest_build.created_at AS newest_build_created_at, newest_build.head_sha AS newest_build_head_sha,
    newest.id AS newest_id, newest.build_id AS newest_build_origin_id, newest.state AS newest_state,
    newest.created_at AS newest_created_at, newest.head_sha AS newest_head_sha,
    (SELECT id FROM publications WHERE project_id = $1 AND branch = b.name
     AND state = 'ready' AND expired_at IS NULL
     ORDER BY created_at DESC, id DESC LIMIT 1) AS latest_publication_id
FROM branches b
LEFT JOIN LATERAL (
    SELECT id, state, created_at, head_sha, build_id FROM publications
    WHERE project_id = $1 AND branch = b.name
    AND NOT (build_id IS NOT NULL AND state IN ('uploading', 'validating', 'failed'))
    AND (state <> 'failed' OR failure_code IS DISTINCT FROM 'superseded')
    ORDER BY created_at DESC, id DESC LIMIT 1
) newest ON true
LEFT JOIN LATERAL (
    SELECT id, state, created_at, head_sha FROM builds
    WHERE project_id = $1 AND branch = b.name
    ORDER BY created_at DESC, id DESC LIMIT 1
) newest_build ON true
WHERE $2::boolean IS NULL OR b.is_default < $2
   OR (b.is_default = $2 AND b.name COLLATE "C" > $3)
ORDER BY b.is_default DESC, b.name COLLATE "C" ASC
LIMIT $4
