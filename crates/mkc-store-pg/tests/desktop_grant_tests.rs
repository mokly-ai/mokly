//! Real desktop grant locking, conditional consumption and retention boundaries.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::{Arc, Barrier};
use std::thread;

use chrono::{DateTime, Duration, Utc};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_store_interface::desktop_grant::DesktopGrant;
use mkc_store_interface::session::Session;
use mkc_store_interface::store::{Callback, Store};
use mkc_store_interface::user::User;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

fn now() -> DateTime<Utc> {
    "2026-11-06T12:00:00Z".parse().unwrap()
}

fn database() -> Option<(Arc<dyn Store>, ScratchSchema)> {
    let schema = ScratchSchema::create("desktop_grant")?;
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(schema.scoped_url())
    .unwrap();
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_user(&User {
                id: Uuid::from_u128(7).into(),
                email: "person@example.com".into(),
                name: "Person".into(),
                created_at: now(),
            })
        }))
        .unwrap();
    Some((store, schema))
}

fn grant(hash: &str) -> DesktopGrant {
    DesktopGrant {
        token_hash: hash.into(),
        challenge: "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs".into(),
        user_id: Uuid::from_u128(7).into(),
        return_to: "/acme/project?branch=topic%2Fwork".into(),
        expires_at: now() + Duration::minutes(5),
        session_expires_at: now() + Duration::hours(3),
        used_at: None,
    }
}

#[test]
fn desktop_grant_concurrent_consumption_commits_exactly_one_session() {
    let Some((store, _schema)) = database() else {
        return;
    };
    let record = grant("digest");
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_desktop_grant(&record)
        }))
        .unwrap();
    let start = Arc::new(Barrier::new(2));
    let workers: Vec<_> = (0..2)
        .map(|index| {
            let store = store.clone();
            let start = start.clone();
            thread::spawn(move || {
                start.wait();
                let mut won = false;
                store
                    .transaction(&mut Callback(&mut |queries| {
                        won = false;
                        let locked = queries.desktop_grant("digest")?.unwrap();
                        assert_eq!(
                            locked.challenge,
                            "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs"
                        );
                        if queries.consume_desktop_grant("digest", now())? {
                            queries.insert_session(&Session {
                                token_hash: format!("{index:064x}"),
                                user_id: locked.user_id,
                                csrf_token: format!("csrf-{index}"),
                                created_at: now(),
                                last_seen_at: now(),
                                expires_at: locked.session_expires_at,
                            })?;
                            won = true;
                        }
                        Ok(())
                    }))
                    .unwrap();
                won
            })
        })
        .collect();
    let winners = workers
        .into_iter()
        .map(|worker| usize::from(worker.join().unwrap()))
        .sum::<usize>();
    assert_eq!(winners, 1);
    store
        .transaction(&mut Callback(&mut |queries| {
            let used = queries.desktop_grant("digest")?.unwrap();
            assert_eq!(used.used_at, Some(now()));
            assert_eq!(used.return_to, "/acme/project?branch=topic%2Fwork");
            let sessions = (0..2)
                .filter_map(|index| queries.session(&format!("{index:064x}")).unwrap())
                .collect::<Vec<_>>();
            assert_eq!(sessions.len(), 1);
            assert_eq!(sessions[0].expires_at, now() + Duration::hours(3));
            Ok(())
        }))
        .unwrap();
}

#[test]
fn desktop_grant_consumption_refuses_expiry_deadline_and_reuse() {
    let Some((store, _schema)) = database() else {
        return;
    };
    store
        .transaction(&mut Callback(&mut |queries| {
            let mut expiry = grant("expiry");
            expiry.expires_at = now();
            let mut deadline = grant("deadline");
            deadline.session_expires_at = now();
            let mut used = grant("used");
            used.used_at = Some(now() - Duration::seconds(1));
            for record in [&expiry, &deadline, &used] {
                queries.insert_desktop_grant(record)?;
            }
            for key in ["expiry", "deadline", "used", "unknown"] {
                assert!(!queries.consume_desktop_grant(key, now())?, "{key}");
            }
            Ok(())
        }))
        .unwrap();
}

#[test]
fn desktop_grant_pruning_keeps_newer_expiry_and_removes_used_and_unused_at_the_cutoff() {
    let Some((store, _schema)) = database() else {
        return;
    };
    let cutoff = now() - Duration::days(7);
    store
        .transaction(&mut Callback(&mut |queries| {
            for (index, delta) in [-1, 0, 1].into_iter().enumerate() {
                for used in [false, true] {
                    let mut record = grant(&format!("{index}-{used}"));
                    record.expires_at = cutoff + Duration::seconds(delta);
                    record.used_at = used.then_some(cutoff - Duration::seconds(1));
                    queries.insert_desktop_grant(&record)?;
                }
            }
            assert_eq!(queries.prune_desktop_grants(cutoff)?, 4);
            for (index, expected) in [(0, false), (1, false), (2, true)] {
                for used in [false, true] {
                    assert_eq!(
                        queries.desktop_grant(&format!("{index}-{used}"))?.is_some(),
                        expected
                    );
                }
            }
            assert_eq!(queries.prune_desktop_grants(cutoff)?, 0);
            Ok(())
        }))
        .unwrap();
}
