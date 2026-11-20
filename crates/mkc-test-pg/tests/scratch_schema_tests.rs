//! Real Postgres scratch-schema selection and cleanup.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::env;

use diesel::sql_types::{Bool, Text};
use diesel::{Connection, PgConnection, RunQueryDsl};
use mkc_test_pg::scratch_schema::ScratchSchema;

#[derive(diesel::QueryableByName)]
struct CurrentSchema {
    #[diesel(sql_type = Text)]
    name: String,
}

#[derive(diesel::QueryableByName)]
struct SchemaExists {
    #[diesel(sql_type = Bool)]
    exists: bool,
}

#[test]
fn schema_is_current_and_is_removed_after_drop() {
    let name = {
        let Some(schema) = ScratchSchema::create("scratch") else {
            return;
        };
        let mut connection = PgConnection::establish(schema.scoped_url()).unwrap();
        let current: CurrentSchema = diesel::sql_query("SELECT current_schema()::text AS name")
            .get_result(&mut connection)
            .unwrap();
        assert_eq!(current.name, schema.name());
        schema.name().to_owned()
    };

    let database_url = env::var("MKC_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/mkc_test".into());
    let mut connection = PgConnection::establish(&database_url).unwrap();
    let exists: SchemaExists =
        diesel::sql_query("SELECT EXISTS (SELECT FROM pg_namespace WHERE nspname = $1) AS exists")
            .bind::<Text, _>(&name)
            .get_result(&mut connection)
            .unwrap();
    assert!(!exists.exists);
}
