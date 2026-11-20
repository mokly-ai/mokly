//! Many installation bindings and the reversing uniqueness constraint in Postgres.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_types::BigInt;
use mkc_test_pg::scratch_schema::ScratchSchema;

#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

fn bind(connection: &mut PgConnection, id: i64) -> QueryResult<usize> {
    diesel::sql_query(
        "INSERT INTO github_installations (id, github_id, app_id, organization_id, account_id, \
         account_name, account_kind, manage_url, active, connected, updated_at) \
         VALUES (md5($1::text)::uuid, $1, 123, \
         '00000000-0000-0000-0000-000000000001', $1, 'account', 'user', \
         'https://github.com/settings/installations/1', true, true, now())",
    )
    .bind::<BigInt, _>(id)
    .execute(connection)
}

#[test]
fn a_workspace_holds_two_installations_and_rollback_restores_uniqueness() {
    let Some(schema) = ScratchSchema::create("workspace_installations") else {
        return;
    };
    let mut connection = PgConnection::establish(schema.scoped_url()).unwrap();
    connection
        .batch_execute(include_str!("../migrations/202609161100_platform/up.sql"))
        .unwrap();
    connection
        .batch_execute(include_str!("../migrations/202609161530_github_app/up.sql"))
        .unwrap();
    connection
        .batch_execute(
            "INSERT INTO organizations (id, name, version, created_at) VALUES \
         ('00000000-0000-0000-0000-000000000001', 'Workspace', 1, now())",
        )
        .unwrap();
    bind(&mut connection, 1).unwrap();
    assert!(bind(&mut connection, 2).is_err());
    let up = include_str!("../migrations/202610291200_workspace_installations/up.sql");
    let down = include_str!("../migrations/202610291200_workspace_installations/down.sql");
    connection.batch_execute(up).unwrap();
    bind(&mut connection, 2).unwrap();
    let count = diesel::sql_query("SELECT count(*) AS count FROM github_installations")
        .get_result::<Count>(&mut connection)
        .unwrap();
    assert_eq!(count.count, 2);
    assert!(
        bind(&mut connection, 2).is_err(),
        "provider identity stays unique"
    );
    connection
        .batch_execute("DELETE FROM github_installations WHERE github_id = 2")
        .unwrap();
    connection.batch_execute(down).unwrap();
    assert!(bind(&mut connection, 2).is_err());
    let indexes = diesel::sql_query(
        "SELECT count(*) AS count FROM pg_indexes WHERE schemaname = current_schema() \
         AND indexname = 'github_installations_organization_id_idx'",
    )
    .get_result::<Count>(&mut connection)
    .unwrap();
    assert_eq!(indexes.count, 0);
    connection.batch_execute(up).unwrap();
    bind(&mut connection, 2).unwrap();
}
