BEGIN;
INSERT INTO organizations (id, name, slug, version, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Reference query plans', 'reference-plans', 1, now());
INSERT INTO organization_slugs (slug, organization_id)
VALUES ('reference-plans', '00000000-0000-0000-0000-000000000001');
INSERT INTO projects (id, organization_id, name, slug, repository, config_path, visibility, version)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001', 'Plans', 'plans', 'test/plans',
        'mokly.config.ts', 'private', 1);
INSERT INTO project_slugs (organization_id, slug, project_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'plans',
        '00000000-0000-0000-0000-000000000002');
INSERT INTO github_installations
    (id, github_id, app_id, organization_id, account_id, account_name,
     account_kind, manage_url, active, connected, updated_at)
VALUES ('00000000-0000-0000-0000-000000000003', 1, 1,
        '00000000-0000-0000-0000-000000000001', 1, 'test', 'organization',
        'https://github.com/settings/installations/1', true, true, now());
INSERT INTO github_repositories
    (id, installation_id, github_id, full_name, default_branch, private, active)
VALUES ('00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000003', 1, 'test/plans', 'branch-1', true, true);
INSERT INTO github_project_repositories (project_id, repository_id)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004');
INSERT INTO github_branches (repository_id, name, head_sha, updated_at)
SELECT '00000000-0000-0000-0000-000000000004', 'branch-' || n, repeat('a', 40), now()
FROM generate_series(1, 50) n;
INSERT INTO github_pull_requests
    (repository_id, number, title, open, merged, head_ref, head_sha, base_ref, base_sha, updated_at)
SELECT '00000000-0000-0000-0000-000000000004', n, 'PR ' || n, true, false,
       'branch-' || n, repeat('a', 40), 'main', repeat('b', 40), now()
FROM generate_series(1, 50) n;
INSERT INTO publications
    (id, project_id, branch, head_sha, pull_request, config_path, exported_at,
     state, created_at, deadline)
SELECT lpad((n * 1000 + attempt)::text, 32, '0')::uuid,
       '00000000-0000-0000-0000-000000000002', 'branch-' || n,
       lpad(attempt::text, 40, '0'), n, 'mokly.config.ts', now(), 'validating',
       now() - attempt * interval '1 second', now() + interval '1 hour'
FROM generate_series(1, 50) n CROSS JOIN generate_series(1, 1000) attempt;
ANALYZE publications;
ANALYZE github_branches;
ANALYZE github_pull_requests;
COMMIT;
