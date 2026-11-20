DROP INDEX publications_failed_age;
CREATE INDEX publications_retained_age ON publications(created_at, id)
    WHERE state IN ('ready', 'failed');
