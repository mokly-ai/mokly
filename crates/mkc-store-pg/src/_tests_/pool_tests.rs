//! Store pool startup failure and real Postgres session count after serial calls.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::net::TcpListener;
use std::sync::Arc;
use std::sync::mpsc;
use std::time::Duration;

use diesel::sql_types::{BigInt, Text};
use diesel::{Connection, PgConnection, RunQueryDsl};
use mkc_store_interface::error::Error;
use mkc_store_interface::store::{Callback, Store};
use mkc_test_pg::scratch_schema::ScratchSchema;
use scheduled_thread_pool::ScheduledThreadPool;

use super::{PgStore, PgStoreFactory, StoreFactory, open_pool, pool_builder};
use crate::runtime::SystemRuntime;

#[derive(diesel::QueryableByName)]
struct Sessions {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

/// Serial calls reuse one session and start no background connection. A
/// connection that opens in the background while the process exits crashed
/// maintenance commands in the OpenSSL exit handler.
#[test]
fn serial_calls_reuse_one_session() {
    let Some(schema) = ScratchSchema::create("pool") else {
        return;
    };
    let tagged_url = format!("{}&application_name={}", schema.scoped_url(), schema.name());
    let worker = Arc::new(ScheduledThreadPool::new(1));
    let store = PgStore {
        pool: open_pool(pool_builder().thread_pool(worker.clone()), &tagged_url).unwrap(),
        runtime: Arc::new(SystemRuntime),
    };
    for _ in 0..3 {
        store.read(&mut Callback(&mut |_| Ok(()))).unwrap();
    }

    // The worker runs jobs in order, so every connection that the calls queued
    // has opened when this marker runs.
    let (done, drained) = mpsc::channel();
    worker.execute(move || done.send(()).unwrap());
    drained.recv_timeout(Duration::from_secs(30)).unwrap();

    let mut observer = PgConnection::establish(schema.scoped_url()).unwrap();
    let sessions = diesel::sql_query(
        "SELECT count(*) AS count FROM pg_stat_activity WHERE application_name = $1",
    )
    .bind::<Text, _>(schema.name())
    .get_result::<Sessions>(&mut observer)
    .unwrap();
    assert_eq!(sessions.count, 1);
}

/// `connect` fails when the database is unreachable, so a command fails at
/// startup and not at its first query.
#[test]
fn connect_fails_when_the_database_is_unreachable() {
    let closed_port = TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let factory = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    };
    let result = factory.connect(&format!(
        "postgres://postgres@127.0.0.1:{closed_port}/mkc?connect_timeout=1"
    ));
    assert!(matches!(result, Err(Error::Internal(_))));
}
