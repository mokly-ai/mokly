//! Database gates and observed lock waits; timing never chooses the winner.

use std::thread;
use std::time::{Duration, Instant};

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_types::{Bool, Integer};

#[derive(QueryableByName)]
struct Pid {
    #[diesel(sql_type = Integer)]
    pid: i32,
}

#[derive(QueryableByName)]
struct Waiting {
    #[diesel(sql_type = Bool)]
    waiting: bool,
}

pub(super) fn pid(connection: &mut PgConnection) -> i32 {
    diesel::sql_query("SELECT pg_backend_pid() AS pid")
        .get_result::<Pid>(connection)
        .unwrap()
        .pid
}

pub(super) fn waiting(connection: &mut PgConnection, pid: i32) -> bool {
    diesel::sql_query("SELECT cardinality(pg_blocking_pids($1)) > 0 AS waiting")
        .bind::<Integer, _>(pid)
        .get_result::<Waiting>(connection)
        .unwrap()
        .waiting
}

pub(super) fn wait_for_lock(connection: &mut PgConnection, pid: i32) {
    let deadline = Instant::now() + Duration::from_secs(10);
    while !waiting(connection, pid) {
        assert!(
            Instant::now() < deadline,
            "transaction {pid} must wait for a lock"
        );
        thread::sleep(Duration::from_millis(5));
    }
}

pub(super) fn gate(connection: &mut PgConnection) -> i32 {
    let key = pid(connection);
    connection
        .batch_execute(&format!(
            "CREATE FUNCTION pause_ready_event() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN PERFORM pg_advisory_xact_lock({key}); RETURN NEW; END $$;
         CREATE TRIGGER pause_ready_event BEFORE INSERT ON publication_events
         FOR EACH ROW WHEN (NEW.kind = 'ready') EXECUTE FUNCTION pause_ready_event();"
        ))
        .unwrap();
    connection
        .batch_execute(&format!("BEGIN; SELECT pg_advisory_xact_lock({key});"))
        .unwrap();
    key
}

pub(super) fn gated_pid(connection: &mut PgConnection, key: i32) -> i32 {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let pid = diesel::sql_query("SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND objid = $1::oid AND NOT granted")
            .bind::<Integer, _>(key).get_result::<Pid>(connection).optional().unwrap();
        if let Some(pid) = pid {
            return pid.pid;
        }
        assert!(
            Instant::now() < deadline,
            "completion must reach the ready event"
        );
        thread::sleep(Duration::from_millis(5));
    }
}

pub(super) fn release(connection: &mut PgConnection) {
    connection.batch_execute("COMMIT").unwrap();
}

pub(super) fn waiting_writer(connection: &mut PgConnection) -> i32 {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let pid = diesel::sql_query(
            "SELECT DISTINCT a.pid FROM pg_stat_activity a JOIN pg_locks l ON l.pid = a.pid
             WHERE a.wait_event_type = 'Lock' AND l.relation IN
             ('projects'::regclass, 'builds'::regclass, 'publications'::regclass)",
        )
        .get_result::<Pid>(connection)
        .optional()
        .unwrap();
        if let Some(pid) = pid {
            return pid.pid;
        }
        assert!(
            Instant::now() < deadline,
            "completion must wait for the ending transaction"
        );
        thread::sleep(Duration::from_millis(5));
    }
}
