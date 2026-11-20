//! Overlapping claims, state bumps and acknowledgements across real connections.

use std::thread;

use chrono::Duration;

use super::support::{fixture, pid, rc, wait_for_lock};

#[test]
fn competing_check_claims_have_one_winner() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let other_pid = pid(&mut second);
    let (id, now) = (b.id, f.now);
    let mut worker = None;
    rc(&mut first, |q| {
        assert!(q.claim_build_check(id, 0, now).unwrap().is_some());
        worker = Some(thread::spawn(move || {
            rc(&mut second, |q| q.claim_build_check(id, 0, now).unwrap())
        }));
        wait_for_lock(&mut observer, other_pid);
    });
    assert!(worker.unwrap().join().unwrap().is_none());
}

#[test]
fn bump_during_delivery_keeps_the_claim_until_success_then_new_state_is_due() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let other_pid = pid(&mut second);
    let (id, now) = (b.id, f.now);
    let mut worker = None;
    let claim = rc(&mut first, |q| {
        let claim = q.claim_build_check(id, 0, now).unwrap().unwrap();
        worker = Some(thread::spawn(move || {
            rc(&mut second, |q| q.bump_build_check(id, now).unwrap())
        }));
        wait_for_lock(&mut observer, other_pid);
        claim
    });
    worker.unwrap().join().unwrap();
    rc(&mut observer, |q| {
        assert!(q.pending_build_checks(now, 100, None).unwrap().is_empty());
        assert!(
            q.claim_build_check(id, claim.attempts, now)
                .unwrap()
                .is_none()
        );
    });
    let mut second = f.connection();
    rc(&mut first, |q| {
        assert!(
            q.deliver_build_check(id, claim.attempts, claim.version)
                .unwrap()
        );
        rc(&mut second, |other| {
            assert!(other.claim_build_check(id, 1, now).unwrap().is_none());
        });
    });
    let newer = rc(&mut second, |q| {
        q.claim_build_check(id, 1, now).unwrap().unwrap()
    });
    assert_eq!(
        (newer.attempts, newer.version, newer.delivered_version),
        (2, 2, 1)
    );
    assert_eq!(newer.claim_expires_at, Some(now + Duration::minutes(5)));
    rc(&mut observer, |q| {
        assert!(!q.deliver_build_check(id, 1, 1).unwrap());
        assert!(!q.retry_build_check(id, 1, true, now, now).unwrap());
        assert!(
            q.deliver_build_check(id, newer.attempts, newer.version)
                .unwrap()
        );
    });
}
