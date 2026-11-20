ALTER TABLE organizations ADD COLUMN slug text;
ALTER TABLE projects ADD COLUMN slug text;

DO $$
DECLARE
    subject record;
    base text;
    candidate text;
    suffix bigint;
    reserved text[] := ARRAY[
        '300', '302', '400', '401', '402', '403', '404', '405',
        '406', '407', '408', '409', '410', '411', '412', '413',
        '414', '415', '416', '417', '418', '419', '420', '421',
        '422', '423', '424', '425', '426', '427', '428', '429',
        '430', '431', '500', '501', '502', '503', '504', '505',
        '506', '507', '508', '509', '510', '511', '693', '694',
        '695', '900', '_astro', '_config', '_expo', '_health', '_router-health', 'about',
        'account', 'admin', 'advisories', 'anonymous', 'any', 'api', 'app', 'apps',
        'assets', 'attributes', 'auth', 'billing', 'blob', 'blog', 'bounty', 'branches',
        'brand', 'business', 'businesses', 'c', 'cache', 'careers', 'case-studies', 'categories',
        'central', 'certification', 'changelog', 'chat', 'cla', 'cloud', 'codereview', 'codespaces',
        'collection', 'collections', 'comments', 'commit', 'commits', 'companies', 'compare', 'complaints', 'connect',
        'contact', 'contributing', 'cookbook', 'copilot', 'coupons', 'customer', 'customer-stories', 'customers',
        'dashboard', 'dashboard-feed', 'dashboards', 'design', 'develop', 'developer', 'diff', 'discover',
        'discussions', 'docs', 'downloads', 'downtime', 'editor', 'editors', 'edu', 'education',
        'enterprise', 'enterprises', 'events', 'explore', 'featured', 'features', 'feed', 'files',
        'fixtures', 'folio', 'forked', 'garage', 'ghost', 'gist', 'gists', 'git-guides',
        'github-copilot', 'graphs', 'groups', 'guide', 'guides', 'help', 'help-wanted', 'home',
        'hooks', 'hosting', 'hovercards', 'identity', 'images', 'inbox', 'individual', 'info',
        'install', 'integration', 'interfaces', 'introduction', 'invalid-email-address', 'investors', 'issues', 'jobs',
        'join', 'journal', 'journals', 'lab', 'labs', 'languages', 'launch', 'layouts',
        'learn', 'legal', 'library', 'linux', 'listings', 'lists', 'login', 'logos',
        'logout', 'mac', 'maintenance', 'malware', 'man', 'marketplace', 'mcp', 'mention',
        'mentioned', 'mentioning', 'mentions', 'migrating', 'milestones', 'mine', 'mirrors', 'mobile',
        'mokly', 'mokly-viewer', 'navigation', 'network', 'new', 'news', 'newsletter', 'newsroom',
        'none', 'nonprofit', 'nonprofits', 'notices', 'notifications', 'oauth', 'offer', 'og',
        'open-source', 'organisations', 'organizations', 'orgs', 'pagefind', 'pages', 'partners', 'payments',
        'personal', 'plans', 'plugins', 'popular', 'popularity', 'posts', 'press', 'preview',
        'pricing', 'privacy', 'professional', 'projects', 'pulls', 'raw', 'readme', 'recommendations',
        'redeem', 'register', 'releases', 'render', 'reply', 'repos', 'repositories', 'resources',
        'restore', 'revert', 'save-net-neutrality', 'saved', 'scraping', 'search', 'security', 'services',
        'sessions', 'settings', 'shareholders', 'showcases', 'sign-in', 'sign-up', 'signin', 'signup',
        'site', 'site-policy', 'sitemap', 'social-impact', 'socials', 'spam', 'sponsors', 'ssh',
        'staff', 'stage', 'starred', 'stars', 'static', 'status', 'statuses', 'storage',
        'store', 'stories', 'styleguide', 'subscriptions', 'suggest', 'suggestion', 'suggestions', 'support',
        'suspended', 'talks', 'teach', 'teacher', 'teachers', 'teaching', 'team', 'teams',
        'ten', 'terms', 'timeline', 'topic', 'topics', 'tos', 'tour', 'train',
        'training', 'translations', 'tree', 'trending', 'undefined', 'updates', 'user-attachments', 'username',
        'users', 'visualization', 'w', 'watching', 'why-github', 'wiki', 'wikis', 'windows',
        'works-with', 'www', 'www0', 'www1', 'www2', 'www3', 'www4', 'www5',
        'www6', 'www7', 'www8', 'www9'
    ];
BEGIN
    FOR subject IN SELECT id, name FROM organizations ORDER BY id LOOP
        base := trim(both '-' FROM regexp_replace(
            lower(normalize(subject.name, NFKD)), '[^a-z0-9]+', '-', 'g'
        ));
        base := rtrim(left(base, 39), '-');
        IF base = '' THEN
            base := 'organization';
        END IF;
        suffix := 1;
        LOOP
            candidate := CASE WHEN suffix = 1 THEN base ELSE
                rtrim(left(base, 39 - length(suffix::text) - 1), '-') || '-' || suffix::text
            END;
            EXIT WHEN NOT candidate = ANY(reserved)
                AND candidate !~ '^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
                AND NOT EXISTS (SELECT 1 FROM organizations WHERE slug = candidate);
            suffix := suffix + 1;
        END LOOP;
        UPDATE organizations SET slug = candidate WHERE id = subject.id;
    END LOOP;

    FOR subject IN SELECT id, organization_id, name FROM projects ORDER BY organization_id, id LOOP
        base := trim(both '-' FROM regexp_replace(
            lower(normalize(subject.name, NFKD)), '[^a-z0-9]+', '-', 'g'
        ));
        base := rtrim(left(base, 100), '-');
        IF base = '' THEN
            base := 'project';
        END IF;
        suffix := 1;
        LOOP
            candidate := CASE WHEN suffix = 1 THEN base ELSE
                rtrim(left(base, 100 - length(suffix::text) - 1), '-') || '-' || suffix::text
            END;
            EXIT WHEN candidate !~ '^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
                AND NOT EXISTS (
                    SELECT 1 FROM projects
                    WHERE organization_id = subject.organization_id AND slug = candidate
                );
            suffix := suffix + 1;
        END LOOP;
        UPDATE projects SET slug = candidate WHERE id = subject.id;
    END LOOP;
END $$;

ALTER TABLE organizations
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT organizations_slug_grammar
        CHECK (length(slug) BETWEEN 1 AND 39 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    ADD CONSTRAINT organizations_slug_not_uuid
        CHECK (slug !~ '^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);

ALTER TABLE projects
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT projects_slug_grammar
        CHECK (length(slug) BETWEEN 1 AND 100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    ADD CONSTRAINT projects_slug_not_uuid
        CHECK (slug !~ '^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
    ADD CONSTRAINT projects_organization_slug_unique UNIQUE (organization_id, slug),
    ADD CONSTRAINT projects_id_organization_unique UNIQUE (id, organization_id);

CREATE TABLE organization_slugs (
    slug text PRIMARY KEY,
    organization_id uuid NOT NULL,
    CONSTRAINT organization_slugs_grammar
        CHECK (length(slug) BETWEEN 1 AND 39 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT organization_slugs_not_uuid
        CHECK (slug !~ '^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
    CONSTRAINT organization_slugs_subject_unique UNIQUE (slug, organization_id),
    CONSTRAINT organization_slugs_organization
        FOREIGN KEY (organization_id) REFERENCES organizations ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE project_slugs (
    organization_id uuid NOT NULL,
    slug text NOT NULL,
    project_id uuid NOT NULL,
    PRIMARY KEY (organization_id, slug),
    CONSTRAINT project_slugs_grammar
        CHECK (length(slug) BETWEEN 1 AND 100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT project_slugs_not_uuid
        CHECK (slug !~ '^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
    CONSTRAINT project_slugs_project
        FOREIGN KEY (project_id, organization_id)
        REFERENCES projects (id, organization_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT project_slugs_subject_unique UNIQUE (organization_id, slug, project_id)
);

INSERT INTO organization_slugs (slug, organization_id)
SELECT slug, id FROM organizations;

INSERT INTO project_slugs (organization_id, slug, project_id)
SELECT organization_id, slug, id FROM projects;

ALTER TABLE organizations ADD CONSTRAINT organizations_current_slug_claim
    FOREIGN KEY (slug, id)
    REFERENCES organization_slugs (slug, organization_id)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE projects ADD CONSTRAINT projects_current_slug_claim
    FOREIGN KEY (organization_id, slug, id)
    REFERENCES project_slugs (organization_id, slug, project_id)
    DEFERRABLE INITIALLY DEFERRED;
