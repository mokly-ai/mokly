//! Real overlapping READ COMMITTED claims and organization starts.

use std::sync::mpsc;
use std::thread;

use chrono::Duration;
use mkc_store_interface::build_state::BuildState;

use super::support::{attempt, finish, fixture, pid, rc, wait_for_lock};

#[test]
fn locked_claim_and_expired_lease_recovery_have_exactly_one_owner() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let mut first = f.connection();
    let mut second = f.connection();
    let a = attempt(f.now);
    rc(&mut first, |q| {
        assert_eq!(q.claim_build(&|| f.now).unwrap().unwrap().id, b.id);
        rc(&mut second, |other| {
            assert!(other.claim_build(&|| f.now).unwrap().is_none());
        });
        q.start_build(b.id, &a).unwrap().unwrap();
    });
    let expired = a.lease_expires_at;
    rc(&mut first, |q| {
        let claimed = q.claim_build(&|| expired).unwrap().unwrap();
        assert_eq!(claimed.id, b.id);
        assert_eq!(claimed.attempt, 1);
        rc(&mut second, |other| {
            assert!(other.claim_build(&|| expired).unwrap().is_none());
        });
        assert!(
            q.finish_build(
                b.id,
                Some(a.lease_token),
                &finish(expired, BuildState::Queued)
            )
            .unwrap()
        );
    });
    rc(&mut second, |q| {
        let new = attempt(expired);
        assert_eq!(q.claim_build(&|| expired).unwrap().unwrap().id, b.id);
        q.start_build(b.id, &new).unwrap().unwrap();
        assert!(
            !q.renew_build(
                b.id,
                a.lease_token,
                &|| new.now,
                (new.lease_expires_at) - (new.now)
            )
            .unwrap()
        );
        assert!(
            !q.finish_build(
                b.id,
                Some(a.lease_token),
                &finish(expired, BuildState::Queued)
            )
            .unwrap()
        );
    });
}

#[test]
fn organization_lock_prevents_two_concurrent_starts_from_exceeding_two_live_leases() {
    let Some(f) = fixture() else {
        return;
    };
    let builds: Vec<_> = (0..3).map(|i| f.build(&format!("branch-{i}"), i)).collect();
    for b in &builds {
        f.schedule(b);
    }
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let second_pid = pid(&mut second);
    rc(&mut first, |q| {
        q.start_build(builds[0].id, &attempt(f.now))
            .unwrap()
            .unwrap();
    });
    let a = attempt(f.now);
    let other_attempt = attempt(f.now);
    let other_id = builds[2].id;
    let (start_tx, start_rx) = mpsc::channel();
    let mut worker = None;
    rc(&mut first, |q| {
        assert_eq!(q.claim_build(&|| f.now).unwrap().unwrap().id, builds[1].id);
        q.start_build(builds[1].id, &a).unwrap().unwrap();
        worker = Some(thread::spawn(move || {
            start_tx.send(()).unwrap();
            rc(&mut second, |other| {
                other.start_build(other_id, &other_attempt).unwrap()
            })
        }));
        start_rx.recv().unwrap();
        wait_for_lock(&mut observer, second_pid);
    });
    assert!(worker.unwrap().join().unwrap().is_none());
    rc(&mut observer, |q| {
        assert!(
            q.claim_build(&|| f.now + Duration::seconds(1))
                .unwrap()
                .is_none()
        );
    });
}
