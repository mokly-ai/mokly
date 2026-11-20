ALTER TABLE github_pull_requests ADD COLUMN author text
    CHECK (author IS NULL OR length(author) > 0);

CREATE INDEX publications_viewer_history ON publications (project_id, created_at DESC, id DESC);
CREATE INDEX publications_viewer_pr ON publications (project_id, pull_request, created_at DESC, id DESC)
    WHERE state = 'ready' AND expired_at IS NULL;
