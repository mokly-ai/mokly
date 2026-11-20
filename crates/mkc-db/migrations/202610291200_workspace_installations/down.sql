DROP INDEX github_installations_organization_id_idx;

ALTER TABLE github_installations
    ADD CONSTRAINT github_installations_organization_id_key UNIQUE (organization_id);
