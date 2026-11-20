SELECT newest_build.id AS newest_build_id, newest_build.state AS newest_build_state,
    newest_build.created_at AS newest_build_created_at, newest_build.head_sha AS newest_build_head_sha,
    newest.id AS newest_id, newest.build_id AS newest_build_origin_id, newest.state AS newest_state,
       newest.created_at AS newest_created_at, newest.head_sha AS newest_head_sha,
       pr.number, pr.title, pr.author, pr.open, pr.merged,
       pr.head_ref AS branch, pr.updated_at, r.full_name AS repository,
       r.github_id AS bound_repository_id, pr.head_repository_id, pr.base_repository_id,
       (SELECT id FROM publications WHERE project_id = $1
        AND pull_request = pr.number AND state = 'ready' AND expired_at IS NULL
        ORDER BY created_at DESC, id DESC LIMIT 1) AS latest_publication_id
FROM github_project_repositories p
JOIN github_repositories r ON r.id = p.repository_id
JOIN github_pull_requests pr ON pr.repository_id = r.id
LEFT JOIN LATERAL (
    SELECT id, state, created_at, head_sha, build_id FROM publications
    WHERE project_id = $1 AND pull_request = pr.number
    AND NOT (build_id IS NOT NULL AND state IN ('uploading', 'validating', 'failed'))
    AND (state <> 'failed' OR failure_code IS DISTINCT FROM 'superseded')
    ORDER BY created_at DESC, id DESC LIMIT 1
) newest ON true
LEFT JOIN LATERAL (
    SELECT id, state, created_at, head_sha FROM builds
    WHERE project_id = $1 AND pull_request = pr.number
    ORDER BY created_at DESC, id DESC LIMIT 1
) newest_build ON true
WHERE p.project_id = $1 AND (
    $2::boolean IS NULL OR (pr.open, pr.updated_at, pr.number) < ($2, $3, $4)
)
ORDER BY pr.open DESC, pr.updated_at DESC, pr.number DESC
LIMIT $5
