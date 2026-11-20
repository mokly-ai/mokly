DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM blobs LIMIT 1)
        OR EXISTS (SELECT 1 FROM publication_files LIMIT 1)
    THEN
        RAISE EXCEPTION 'project-owned blobs need an empty publication store; reset this environment';
    END IF;
END;
$$;

DROP TRIGGER publication_file_reference ON publication_files;

DROP INDEX publication_files_hash;
DROP INDEX blobs_collection_retry;
DROP INDEX blobs_collection_grace;

ALTER TABLE publication_files
    DROP CONSTRAINT publication_files_blob_hash_fkey,
    DROP CONSTRAINT publication_files_publication_id_fkey;

ALTER TABLE blobs ADD COLUMN project_id uuid NOT NULL;
ALTER TABLE publication_files ADD COLUMN project_id uuid NOT NULL;

ALTER TABLE blobs DROP CONSTRAINT blobs_pkey;

ALTER TABLE publications
    ADD CONSTRAINT publications_id_project_id_key UNIQUE (id, project_id);
ALTER TABLE blobs
    ADD CONSTRAINT blobs_pkey PRIMARY KEY (project_id, hash),
    ADD CONSTRAINT blobs_hash_incarnation_key UNIQUE (hash, incarnation);
ALTER TABLE publication_files
    ADD CONSTRAINT publication_files_publication_project_fkey
        FOREIGN KEY (publication_id, project_id)
        REFERENCES publications (id, project_id) ON DELETE CASCADE,
    ADD CONSTRAINT publication_files_project_blob_fkey
        FOREIGN KEY (project_id, blob_hash)
        REFERENCES blobs (project_id, hash);

CREATE INDEX publication_files_hash
    ON publication_files(project_id, blob_hash);
CREATE INDEX blobs_collection_grace
    ON blobs(unreferenced_at, project_id, hash)
    WHERE ref_count = 0 AND NOT deleting;
CREATE INDEX blobs_collection_retry
    ON blobs(project_id, hash)
    WHERE ref_count = 0 AND deleting;

CREATE OR REPLACE FUNCTION publication_file_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (
            SELECT 1 FROM publications
            WHERE id = NEW.publication_id
              AND project_id = NEW.project_id
              AND state = 'validating'
        ) THEN
            RAISE EXCEPTION 'file reservation requires validating publication';
        END IF;
        UPDATE blobs SET ref_count = ref_count + 1, unreferenced_at = NULL
        WHERE project_id = NEW.project_id
          AND hash = NEW.blob_hash
          AND NOT deleting;
        IF NOT FOUND THEN RAISE EXCEPTION 'blob is unavailable for reservation'; END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'publication file references are immutable';
    ELSE
        UPDATE blobs SET ref_count = ref_count - 1,
            unreferenced_at = CASE WHEN ref_count = 1 THEN clock_timestamp() ELSE NULL END
        WHERE project_id = OLD.project_id AND hash = OLD.blob_hash;
        RETURN OLD;
    END IF;
END;
$$;

CREATE TRIGGER publication_file_reference
AFTER INSERT OR UPDATE OR DELETE ON publication_files
FOR EACH ROW EXECUTE FUNCTION publication_file_reference();
