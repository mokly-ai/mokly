ALTER TABLE publication_screen_views RENAME COLUMN screen_path TO screen_id;

CREATE OR REPLACE FUNCTION publication_screen_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR NOT EXISTS (
        SELECT 1 FROM publications WHERE id = NEW.publication_id
        AND state = 'validating' AND comparison_path IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'screen selection requires validating comparison';
    END IF;
    NEW.screen_hash := sha256(convert_to(NEW.screen_id, 'UTF8'));
    RETURN NEW;
END;
$$;
