DROP TABLE build_checks;
DROP TABLE build_log_chunks;
DROP TABLE build_upload_grants;
ALTER TABLE publications DROP CONSTRAINT publications_build_event;
ALTER TABLE publications DROP COLUMN build_failure_event_id;
ALTER TABLE publications DROP COLUMN build_id;
DROP TABLE builds;
ALTER TABLE projects DROP COLUMN automatic_builds;
