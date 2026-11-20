//! Clock samples occur while every required ownership lock is held.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use chrono::Duration;
use mkc_store_interface::build_clock::BuildClockMock;
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::store::Callback;
use unimock::{MockFn, Unimock, matching};

use super::grant_tests::grant;
use super::lock_support::assert_locked;
use super::support::{attempt, finish, fixture};

#[test]
fn claim_samples_its_guard_under_both_organization_and_build_locks() {
    let Some(f) = fixture() else { return };
    let build = f.build("main", 1);
    f.schedule(&build);
    let observer = Mutex::new(f.connection());
    let calls = Arc::new(AtomicUsize::new(0));
    let count = calls.clone();
    let organization = f.project.organization_id;
    let now = f.now;
    let id = build.id;
    let clock = Unimock::new(
        BuildClockMock::now
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                let call = count.fetch_add(1, Ordering::SeqCst);
                if call > 0 {
                    let mut connection = observer.lock().unwrap();
                    assert_locked(&mut connection, "organizations", organization.0);
                    if call > 1 {
                        assert_locked(&mut connection, "builds", id.0);
                    }
                }
                now
            }))
            .n_times(3),
    );
    f.store
        .transaction(&mut Callback(&mut |q| {
            assert_eq!(q.claim_build(&clock)?.unwrap().id, build.id);
            q.finish_build(build.id, None, &finish(now, BuildState::Cancelled))?;
            Ok(())
        }))
        .unwrap();
    assert_eq!(calls.load(Ordering::SeqCst), 3);
}

#[test]
fn renewal_and_consumption_sample_only_after_their_complete_lock_sets() {
    for consume in [false, true] {
        let Some(f) = fixture() else { return };
        let build = f.build("main", 1);
        f.schedule(&build);
        let a = attempt(f.now);
        let g = grant(build.id, &a);
        let publication = f.publication(&build);
        f.store
            .transaction(&mut Callback(&mut |q| {
                q.start_build(build.id, &a)?.unwrap();
                q.mint_build_grant(&g)?;
                q.insert_publication(&publication)
            }))
            .unwrap();
        let observer = Mutex::new(f.connection());
        let now = f.now;
        let project = f.project.id;
        let clock = Unimock::new(
            BuildClockMock::now
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    let mut connection = observer.lock().unwrap();
                    assert_locked(&mut connection, "builds", build.id.0);
                    if consume {
                        assert_locked(&mut connection, "projects", project.0);
                        assert_locked(&mut connection, "build_upload_grants", g.id);
                        assert_locked(&mut connection, "publications", publication.id.0);
                    }
                    now
                })),
        );
        f.store
            .transaction(&mut Callback(&mut |q| {
                if consume {
                    assert!(q.consume_build_grant(g.id, publication.id, &clock)?);
                } else {
                    assert!(q.renew_build(
                        build.id,
                        a.lease_token,
                        &clock,
                        Duration::minutes(2)
                    )?);
                }
                Ok(())
            }))
            .unwrap();
    }
}
