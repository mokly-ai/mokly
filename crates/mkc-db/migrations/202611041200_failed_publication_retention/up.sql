DROP INDEX publications_retained_age;
CREATE INDEX publications_failed_age ON publications(created_at, id)
    WHERE state = 'failed';
