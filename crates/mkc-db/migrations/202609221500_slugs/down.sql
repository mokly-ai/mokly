ALTER TABLE projects DROP CONSTRAINT projects_current_slug_claim;
ALTER TABLE organizations DROP CONSTRAINT organizations_current_slug_claim;

DROP TABLE project_slugs;
DROP TABLE organization_slugs;

ALTER TABLE projects
    DROP CONSTRAINT projects_id_organization_unique,
    DROP COLUMN slug;

ALTER TABLE organizations DROP COLUMN slug;
