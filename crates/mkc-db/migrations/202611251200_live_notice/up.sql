CREATE FUNCTION mkc_live_notice(project uuid, kind text, id uuid, sequence bigint)
RETURNS void
LANGUAGE sql
AS $$
    SELECT pg_catalog.pg_notify(
        'mkc_live_notice',
        pg_catalog.json_build_object(
            'project', project,
            'kind', kind,
            'id', id,
            'sequence', sequence
        )::text
    );
$$;
