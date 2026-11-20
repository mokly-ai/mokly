ALTER TABLE publications
    DROP CONSTRAINT publications_check3,
    DROP CONSTRAINT publications_check8,
    ADD CONSTRAINT publications_check3
        CHECK (changes_state IS NULL OR (changes_state = 'no-comparison') = (base_sha IS NULL)),
    ADD CONSTRAINT publications_check8
        CHECK ((base_ref IS NULL) = (base_sha IS NULL));

CREATE OR REPLACE FUNCTION publication_screen_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR NOT EXISTS (
        SELECT 1 FROM publications WHERE id = NEW.publication_id
        AND state = 'validating' AND base_sha IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'screen selection requires validating comparison';
    END IF;
    NEW.screen_hash := sha256(convert_to(NEW.screen_path, 'UTF8'));
    RETURN NEW;
END;
$$;
