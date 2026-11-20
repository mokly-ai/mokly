DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM publications
        WHERE (base_sha IS NULL) <> (comparison_path IS NULL)
    ) THEN
        RAISE EXCEPTION 'comparison paths cannot be recovered from stored indexes in SQL; reset this environment before rollback';
    END IF;
END;
$$;

ALTER TABLE publications
    DROP CONSTRAINT publications_check3,
    DROP CONSTRAINT publications_check8,
    ADD CONSTRAINT publications_check3
        CHECK (changes_state IS NULL OR (changes_state = 'no-comparison') = (comparison_path IS NULL)),
    ADD CONSTRAINT publications_check8
        CHECK ((base_ref IS NULL AND base_sha IS NULL AND comparison_path IS NULL)
            OR (base_ref IS NOT NULL AND base_sha IS NOT NULL AND comparison_path IS NOT NULL));

CREATE OR REPLACE FUNCTION publication_screen_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR NOT EXISTS (
        SELECT 1 FROM publications WHERE id = NEW.publication_id
        AND state = 'validating' AND comparison_path IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'screen selection requires validating comparison';
    END IF;
    NEW.screen_hash := sha256(convert_to(NEW.screen_path, 'UTF8'));
    RETURN NEW;
END;
$$;
