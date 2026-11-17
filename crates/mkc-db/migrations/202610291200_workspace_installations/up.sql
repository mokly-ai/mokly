ALTER TABLE github_installations
    DROP CONSTRAINT github_installations_organization_id_key;

CREATE INDEX github_installations_organization_id_idx
    ON github_installations (organization_id);
