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
    DROP CONSTRAINT publication_files_project_blob_fkey,
    DROP CONSTRAINT publication_files_publication_project_fkey;
ALTER TABLE blobs
    DROP CONSTRAINT blobs_hash_incarnation_key,
    DROP CONSTRAINT blobs_pkey;

ALTER TABLE publication_files DROP COLUMN project_id;
ALTER TABLE blobs DROP COLUMN project_id;

ALTER TABLE blobs ADD CONSTRAINT blobs_pkey PRIMARY KEY (hash);
ALTER TABLE publications DROP CONSTRAINT publications_id_project_id_key;
ALTER TABLE publication_files
    ADD CONSTRAINT publication_files_publication_id_fkey
        FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    ADD CONSTRAINT publication_files_blob_hash_fkey
        FOREIGN KEY (blob_hash) REFERENCES blobs(hash);

CREATE INDEX publication_files_hash ON publication_files(blob_hash);
CREATE INDEX blobs_collection_grace ON blobs(unreferenced_at, hash)
    WHERE ref_count = 0 AND NOT deleting;
CREATE INDEX blobs_collection_retry ON blobs(hash)
    WHERE ref_count = 0 AND deleting;

CREATE OR REPLACE FUNCTION publication_file_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (SELECT 1 FROM publications WHERE id = NEW.publication_id AND state = 'validating') THEN
            RAISE EXCEPTION 'file reservation requires validating publication';
        END IF;
        UPDATE blobs SET ref_count = ref_count + 1, unreferenced_at = NULL
        WHERE hash = NEW.blob_hash AND NOT deleting;
        IF NOT FOUND THEN RAISE EXCEPTION 'blob is unavailable for reservation'; END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'publication file references are immutable';
    ELSE
        UPDATE blobs SET ref_count = ref_count - 1,
            unreferenced_at = CASE WHEN ref_count = 1 THEN clock_timestamp() ELSE NULL END
        WHERE hash = OLD.blob_hash;
        RETURN OLD;
    END IF;
END;
$$;

CREATE TRIGGER publication_file_reference
AFTER INSERT OR UPDATE OR DELETE ON publication_files
FOR EACH ROW EXECUTE FUNCTION publication_file_reference();
