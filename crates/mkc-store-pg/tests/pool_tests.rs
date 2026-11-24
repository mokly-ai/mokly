//! Real Postgres connection count of a freshly connected store pool.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use diesel::sql_types::{BigInt, Text};
use diesel::{Connection, PgConnection, RunQueryDsl};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;
use mkc_test_pg::scratch_schema::ScratchSchema;

#[derive(diesel::QueryableByName)]
struct Sessions {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

/// A connected but idle store holds one database session, so idle pods leave
/// the instance's connection slots to the pods and jobs that need them.
#[test]
fn idle_store_holds_one_session() {
    let Some(schema) = ScratchSchema::create("pool") else {
        return;
    };
    let tagged_url = format!("{}&application_name={}", schema.scoped_url(), schema.name());
    let factory: &dyn StoreFactory = &PgStoreFactory {
        runtime: Arc::new(runtime::SystemRuntime),
    };
    let _store = factory.connect(&tagged_url).unwrap();

    let mut observer = PgConnection::establish(schema.scoped_url()).unwrap();
    let sessions = diesel::sql_query(
        "SELECT count(*) AS count FROM pg_stat_activity WHERE application_name = $1",
    )
    .bind::<Text, _>(schema.name())
    .get_result::<Sessions>(&mut observer)
    .unwrap();
    assert_eq!(sessions.count, 1);
}
