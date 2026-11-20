//! Empty-store project-owned blob migration checks against real Postgres.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use mkc_test_pg::scratch_schema::ScratchSchema;

const RESET_MESSAGE: &str =
    "project-owned blobs need an empty publication store; reset this environment";
const UP: &str = include_str!("../migrations/202609271200_project_owned_blobs/up.sql");
const DOWN: &str = include_str!("../migrations/202609271200_project_owned_blobs/down.sql");

struct TestDatabase {
    connection: PgConnection,
    _schema: ScratchSchema,
}

fn database() -> Option<TestDatabase> {
    let schema = ScratchSchema::create("project_blob_migration")?;
    let connection = PgConnection::establish(schema.scoped_url()).unwrap();
    Some(TestDatabase {
        connection,
        _schema: schema,
    })
}

fn apply_baseline(connection: &mut PgConnection) {
    for migration in [
        include_str!("../migrations/202609161100_platform/up.sql"),
        include_str!("../migrations/202609162000_publications/up.sql"),
        include_str!("../migrations/202609171200_retention_indexes/up.sql"),
        include_str!("../migrations/202609261200_blob_durability/up.sql"),
    ] {
        connection.batch_execute(migration).unwrap();
    }
}

fn assert_reset_error(result: QueryResult<()>) {
    match result.expect_err("a populated publication store must stop the migration") {
        DieselError::DatabaseError(_, information) => {
            assert_eq!(information.message(), RESET_MESSAGE);
        }
        error => panic!("expected a database error, got {error}"),
    }
}

#[test]
fn migration_applies_and_rolls_back_on_an_empty_store() {
    let Some(mut database) = database() else {
        return;
    };
    apply_baseline(&mut database.connection);

    database.connection.batch_execute(UP).unwrap();
    database.connection.batch_execute(DOWN).unwrap();
}

#[test]
fn both_directions_refuse_a_blob_row_with_the_reset_message() {
    let Some(mut database) = database() else {
        return;
    };
    let connection = &mut database.connection;
    apply_baseline(connection);
    connection
        .batch_execute(
            "INSERT INTO blobs \
             (hash, incarnation, size, content_type, unreferenced_at) VALUES \
             (repeat('a', 64), '00000000-0000-0000-0000-000000000001', \
              0, 'application/octet-stream', clock_timestamp())",
        )
        .unwrap();

    assert_reset_error(connection.batch_execute(UP));
    connection.batch_execute("DELETE FROM blobs").unwrap();
    connection.batch_execute(UP).unwrap();
    connection
        .batch_execute(
            "INSERT INTO blobs \
             (project_id, hash, incarnation, size, content_type, unreferenced_at) VALUES \
             ('00000000-0000-0000-0000-000000000101', repeat('b', 64), \
              '00000000-0000-0000-0000-000000000002', 0, \
              'application/octet-stream', clock_timestamp())",
        )
        .unwrap();

    assert_reset_error(connection.batch_execute(DOWN));
}
