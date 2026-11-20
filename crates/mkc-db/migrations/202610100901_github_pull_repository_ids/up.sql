ALTER TABLE github_pull_requests
    ADD COLUMN head_repository_id BIGINT CHECK (head_repository_id > 0),
    ADD COLUMN base_repository_id BIGINT CHECK (base_repository_id > 0);
