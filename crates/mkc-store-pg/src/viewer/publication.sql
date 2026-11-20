SELECT p.*, pr.number AS origin_number, pr.title AS origin_title,
       pr.author AS origin_author,
       CASE WHEN pr.number IS NOT NULL THEN r.full_name END AS origin_repository
FROM publications p
LEFT JOIN github_project_repositories binding ON binding.project_id = p.project_id
LEFT JOIN github_repositories r ON r.id = binding.repository_id
LEFT JOIN github_pull_requests pr ON pr.repository_id = r.id AND pr.number = p.pull_request
WHERE p.project_id = $1
  AND ($2::uuid IS NULL OR p.id = $2)
  AND ($2::uuid IS NULL OR (p.state <> 'expired' AND p.expired_at IS NULL))
  AND ($2::uuid IS NOT NULL OR NOT (p.build_id IS NOT NULL AND p.state IN ('uploading', 'validating', 'failed')))
  AND ($3::text IS NULL OR p.branch = $3)
  AND ($4::bigint IS NULL OR p.pull_request = $4)
  AND ($5::timestamptz IS NULL OR (p.created_at, p.id) < ($5, $6))
ORDER BY p.created_at DESC, p.id DESC
LIMIT $7
