CREATE INDEX publications_viewer_branch_attempt
    ON publications (project_id, branch, created_at DESC, id DESC)
    INCLUDE (state, head_sha) WHERE branch IS NOT NULL;
CREATE INDEX publications_viewer_pr_attempt
    ON publications (project_id, pull_request, created_at DESC, id DESC)
    INCLUDE (state, head_sha) WHERE pull_request IS NOT NULL;
