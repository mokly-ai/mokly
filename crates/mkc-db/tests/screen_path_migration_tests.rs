//! Screen identity migration preserves digests and validating-only inserts both ways.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::fs;
use std::path::Path;

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Text};
use mkc_test_pg::scratch_schema::ScratchSchema;

#[derive(QueryableByName)]
struct StoredScreen {
    #[diesel(sql_type = BigInt)]
    id: i64,
    #[diesel(sql_type = Text)]
    path: String,
    #[diesel(sql_type = Text)]
    digest: String,
}

fn rows(connection: &mut PgConnection, column: &str) -> Vec<StoredScreen> {
    diesel::sql_query(format!(
        "SELECT id, {column} AS path, encode(screen_hash, 'hex') AS digest \
        FROM publication_screen_views ORDER BY id"
    ))
    .load(connection)
    .unwrap()
}

fn insert(connection: &mut PgConnection, column: &str, path: &str) {
    diesel::sql_query(format!(
        "INSERT INTO publication_screen_views (publication_id, {column}, viewport, scheme) \
        VALUES ('00000000-0000-0000-0000-000000000003', $1, 'desktop', 'light')"
    ))
    .bind::<Text, _>(path)
    .execute(connection)
    .unwrap();
    let rows = rows(connection, column);
    let last = rows.last().unwrap();
    let expected = diesel::sql_query("SELECT 0::bigint AS id, $1 AS path, encode(sha256(convert_to($1, 'UTF8')), 'hex') AS digest")
        .bind::<Text, _>(path)
        .get_result::<StoredScreen>(connection)
        .unwrap();
    assert_eq!(last.path, path);
    assert_eq!(last.digest, expected.digest);
    assert!(
        diesel::sql_query(format!(
            "UPDATE publication_screen_views SET {column} = 'changed' WHERE id = {}",
            last.id
        ))
        .execute(connection)
        .is_err()
    );
}

#[test]
fn path_rename_preserves_existing_data_and_digest_trigger_in_both_directions() {
    let Some(schema) = ScratchSchema::create("screen_path_migration") else {
        return;
    };
    let mut connection = PgConnection::establish(schema.scoped_url()).unwrap();
    connection
        .batch_execute(include_str!("../migrations/202609161100_platform/up.sql"))
        .unwrap();
    connection
        .batch_execute(include_str!(
            "../migrations/202609162000_publications/up.sql"
        ))
        .unwrap();
    connection.batch_execute(
        "INSERT INTO organizations (id, name, version, created_at) VALUES \
        ('00000000-0000-0000-0000-000000000001', 'Migration', 1, now()); \
        INSERT INTO projects (id, organization_id, name, repository, config_path, visibility, version) VALUES \
        ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Paths', 'a/b', 'mokly.config.ts', 'public', 1); \
        INSERT INTO publications (id, project_id, state, created_at, deadline, branch, head_sha, base_ref, base_sha, config_path, exported_at, comparison_path) VALUES \
        ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'validating', now(), now() + interval '1 hour', 'main', repeat('a', 40), 'main', repeat('b', 40), 'mokly.config.ts', now(), 'review.json');"
    ).unwrap();
    insert(&mut connection, "screen_id", "Before/Screen_1");
    let original = rows(&mut connection, "screen_id").remove(0);
    let migration =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations/202610081500_screen_paths");
    connection
        .batch_execute(&fs::read_to_string(migration.join("up.sql")).unwrap())
        .unwrap();
    let renamed = rows(&mut connection, "screen_path").remove(0);
    assert_eq!(
        (renamed.id, renamed.path, renamed.digest),
        (original.id, original.path, original.digest)
    );
    insert(&mut connection, "screen_path", "After/Screen_1");
    insert(&mut connection, "screen_path", &"a".repeat(2048));
    insert(&mut connection, "screen_path", &"a".repeat(8000));
    insert(&mut connection, "screen_path", "Unicode/é");
    connection
        .batch_execute(&fs::read_to_string(migration.join("down.sql")).unwrap())
        .unwrap();
    assert_eq!(rows(&mut connection, "screen_id").len(), 5);
    insert(&mut connection, "screen_id", "Rollback/Screen_1");
    connection.batch_execute("UPDATE publications SET state = 'ready', changes_state = 'available', changes_added = 0, changes_changed = 0, changes_removed = 0").unwrap();
    assert!(diesel::sql_query("INSERT INTO publication_screen_views (publication_id, screen_id, viewport, scheme) VALUES ('00000000-0000-0000-0000-000000000003', 'Refused', 'mobile', 'dark')").execute(&mut connection).is_err());
}
