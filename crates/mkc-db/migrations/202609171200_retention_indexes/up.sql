CREATE INDEX publications_attempt_deadline ON publications(deadline, id)
    WHERE state IN ('uploading', 'validating');
CREATE INDEX publications_retained_age ON publications(created_at, id)
    WHERE state IN ('ready', 'failed');
CREATE INDEX blobs_collection_grace ON blobs(unreferenced_at, hash)
    WHERE ref_count = 0 AND NOT deleting;
CREATE INDEX blobs_collection_retry ON blobs(hash)
    WHERE ref_count = 0 AND deleting;
CREATE INDEX publication_events_dead_letters ON publication_events(id)
    WHERE delivered_at IS NULL AND dead_lettered_at IS NOT NULL;
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX sessions_idle_expiry ON sessions(last_seen_at);
CREATE INDEX auth_rate_limits_expiry ON auth_rate_limits(resets_at);
