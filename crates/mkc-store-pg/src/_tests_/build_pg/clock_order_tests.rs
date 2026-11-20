//! Ownership checks must use the clock after database lock waits.

use std::sync::{Arc, Mutex};
use std::thread;

use chrono::Duration;
use diesel::prelude::*;
use diesel::sql_types::Uuid as SqlUuid;
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::support::{attempt, fixture, pid, rc, wait_for_lock};

#[test]
fn delayed_renewal_uses_the_time_after_its_build_lock() {
    let Some(f) = fixture() else { return };
    let builds: Vec<_> = (0..3).map(|i| f.build(&format!("branch-{i}"), i)).collect();
    for build in &builds {
        f.schedule(build);
    }
    let a = attempt(f.now);
    let mut b = attempt(f.now);
    b.lease_expires_at += Duration::minutes(2);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(builds[0].id, &a)?.unwrap();
            q.start_build(builds[1].id, &b)?.unwrap();
            Ok(())
        }))
        .unwrap();
    let mut holder = f.connection();
    let mut renewal = f.connection();
    let mut replica = f.connection();
    let mut observer = f.connection();
    let renewal_pid = pid(&mut renewal);
    let clock = Arc::new(Mutex::new(f.now + Duration::seconds(30)));
    let current = clock.clone();
    let id = builds[0].id;
    let mut worker = None;
    let after_expiry = f.now + Duration::seconds(130);
    holder
        .build_transaction()
        .read_committed()
        .run::<_, diesel::result::Error, _>(|connection| {
            diesel::sql_query("SELECT id FROM builds WHERE id = $1 FOR UPDATE")
                .bind::<SqlUuid, _>(id.0)
                .execute(connection)?;
            worker = Some(thread::spawn(move || {
                rc(&mut renewal, |q| {
                    q.renew_build(
                        id,
                        a.lease_token,
                        &|| *current.lock().unwrap(),
                        Duration::minutes(2),
                    )
                })
            }));
            wait_for_lock(&mut observer, renewal_pid);
            *clock.lock().unwrap() = after_expiry;
            rc(&mut replica, |q| {
                assert_eq!(
                    q.claim_build(&|| after_expiry).unwrap().unwrap().id,
                    builds[2].id
                );
                q.start_build(builds[2].id, &attempt(after_expiry))
                    .unwrap()
                    .unwrap();
            });
            Ok(())
        })
        .unwrap();
    assert!(
        !worker.unwrap().join().unwrap().unwrap(),
        "expired owner must lose its lease"
    );
    rc(&mut observer, |q| {
        assert_eq!(
            q.build(f.project.id, id).unwrap().unwrap().lease_expires_at,
            Some(a.lease_expires_at)
        );
        assert!(q.claim_build(&|| after_expiry).unwrap().is_some());
    });
}

#[test]
fn delayed_claim_samples_again_after_its_locks() {
    let Some(f) = fixture() else { return };
    let build = f.build("main", 1);
    f.schedule(&build);
    let mut holder = f.connection();
    let mut claiming = f.connection();
    let mut observer = f.connection();
    let claiming_pid = pid(&mut claiming);
    let clock = Arc::new(Mutex::new(f.now));
    let current = clock.clone();
    let samples = Arc::new(Mutex::new(Vec::new()));
    let captured = samples.clone();
    let later = f.now + Duration::seconds(130);
    let mut worker = None;
    holder
        .build_transaction()
        .read_committed()
        .run::<_, diesel::result::Error, _>(|connection| {
            diesel::sql_query("LOCK TABLE builds IN ACCESS EXCLUSIVE MODE").execute(connection)?;
            worker = Some(thread::spawn(move || {
                let sample = || {
                    let at = *current.lock().unwrap();
                    captured.lock().unwrap().push(at);
                    at
                };
                rc(&mut claiming, |q| q.claim_build(&sample))
            }));
            wait_for_lock(&mut observer, claiming_pid);
            *clock.lock().unwrap() = later;
            Ok(())
        })
        .unwrap();
    assert_eq!(
        worker.unwrap().join().unwrap().unwrap().unwrap().id,
        build.id
    );
    assert_eq!(samples.lock().unwrap().last(), Some(&later));
}

#[test]
fn delayed_grant_consumption_samples_after_every_required_lock() {
    for table in ["projects", "builds", "build_upload_grants", "publications"] {
        let Some(f) = fixture() else { return };
        let build = f.build("main", 1);
        f.schedule(&build);
        let a = attempt(f.now);
        let publication = f.publication(&build);
        let grant = BuildUploadGrant {
            id: Uuid::now_v7(),
            build_id: build.id,
            attempt: 1,
            token_digest: [7; 32],
            expires_at: a.deadline_at,
            consumed_at: None,
            outcome: None,
            created_at: f.now,
        };
        f.store
            .transaction(&mut Callback(&mut |q| {
                q.start_build(build.id, &a)?.unwrap();
                assert!(q.mint_build_grant(&grant)?);
                q.insert_publication(&publication)
            }))
            .unwrap();
        let mut holder = f.connection();
        let mut consuming = f.connection();
        let mut observer = f.connection();
        let consuming_pid = pid(&mut consuming);
        let clock = Arc::new(Mutex::new(f.now + Duration::seconds(30)));
        let current = clock.clone();
        let id = match table {
            "projects" => f.project.id.0,
            "builds" => build.id.0,
            "build_upload_grants" => grant.id,
            _ => publication.id.0,
        };
        let mut worker = None;
        holder
            .build_transaction()
            .read_committed()
            .run::<_, diesel::result::Error, _>(|connection| {
                diesel::sql_query(format!("SELECT id FROM {table} WHERE id = $1 FOR UPDATE"))
                    .bind::<SqlUuid, _>(id)
                    .execute(connection)?;
                worker = Some(thread::spawn(move || {
                    rc(&mut consuming, |q| {
                        q.consume_build_grant(grant.id, publication.id, &|| {
                            *current.lock().unwrap()
                        })
                    })
                }));
                wait_for_lock(&mut observer, consuming_pid);
                *clock.lock().unwrap() = a.lease_expires_at;
                Ok(())
            })
            .unwrap();
        assert!(
            !worker.unwrap().join().unwrap().unwrap(),
            "expired consumption after {table} wait"
        );
        rc(&mut observer, |q| {
            assert!(
                q.build_grant(&[7; 32])
                    .unwrap()
                    .unwrap()
                    .consumed_at
                    .is_none()
            );
            assert!(
                q.build(f.project.id, build.id)
                    .unwrap()
                    .unwrap()
                    .publication_id
                    .is_none()
            );
        });
    }
}
