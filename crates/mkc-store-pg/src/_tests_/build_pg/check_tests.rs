//! Outbox due times, claims, backoff, bumps, dead letters and requeue fencing.

use chrono::Duration;
use mkc_store_interface::store::Callback;

use super::support::fixture;

#[test]
fn bump_preserves_claim_and_success_acknowledges_only_the_claimed_state() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    f.store
        .transaction(&mut Callback(&mut |q| {
            assert_eq!(
                q.pending_build_checks(f.now, 100, Some(f.project.id))?
                    .len(),
                1
            );
            assert!(
                q.pending_build_checks(f.now, 100, Some(uuid::Uuid::now_v7().into()))?
                    .is_empty()
            );
            let claim = q.claim_build_check(b.id, 0, f.now)?.unwrap();
            assert_eq!((claim.attempts, claim.version), (1, 1));
            assert_eq!(claim.claim_expires_at, Some(f.now + Duration::minutes(5)));
            q.bump_build_check(b.id, f.now)?;
            assert!(q.pending_build_checks(f.now, 100, None)?.is_empty());
            assert!(q.claim_build_check(b.id, 1, f.now)?.is_none());
            assert!(q.deliver_build_check(b.id, claim.attempts, claim.version)?);
            let due = q.pending_build_checks(f.now, 100, None)?;
            assert_eq!((due[0].version, due[0].delivered_version), (2, 1));
            let next = q.claim_build_check(b.id, 1, f.now)?.unwrap();
            assert!(!q.deliver_build_check(b.id, 1, 1)?);
            assert!(!q.retry_build_check(b.id, 1, true, f.now, f.now)?);
            assert!(q.deliver_build_check(b.id, next.attempts, next.version)?);
            assert!(!q.retry_build_check(b.id, next.attempts, true, f.now, f.now)?);
            assert!(q.pending_build_checks(f.now, 100, None)?.is_empty());
            Ok(())
        }))
        .unwrap();
}

#[test]
fn claim_expiry_and_backoff_fence_stale_success_and_failure() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.claim_build_check(b.id, 0, f.now)?.unwrap();
            let lapse = f.now + Duration::minutes(5);
            assert!(
                q.pending_build_checks(lapse - Duration::seconds(1), 100, None)?
                    .is_empty()
            );
            assert_eq!(q.pending_build_checks(lapse, 100, None)?.len(), 1);
            assert!(q.claim_build_check(b.id, 0, lapse)?.is_none());
            let new = q.claim_build_check(b.id, 1, lapse)?.unwrap();
            assert!(!q.deliver_build_check(b.id, 1, 1)?);
            assert!(!q.retry_build_check(b.id, 1, true, lapse, lapse)?);
            let due = lapse + Duration::seconds(120);
            assert!(q.retry_build_check(b.id, new.attempts, false, due, lapse)?);
            assert!(
                q.pending_build_checks(due - Duration::seconds(1), 100, None)?
                    .is_empty()
            );
            let pending = q.pending_build_checks(due, 100, None)?;
            assert_eq!((pending[0].attempts, pending[0].permanent_failures), (2, 0));
            Ok(())
        }))
        .unwrap();
}

#[test]
fn permanent_budget_dead_letters_requeue_and_bump_reset_without_losing_retry_fence() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    f.store
        .transaction(&mut Callback(&mut |q| {
            let mut now = f.now;
            for observed in 0..5 {
                let c = q.claim_build_check(b.id, observed, now)?.unwrap();
                assert_eq!(c.permanent_failures, observed);
                let due = now + Duration::seconds(60 * (1 << observed));
                assert!(q.retry_build_check(b.id, c.attempts, true, due, now)?);
                now = due;
            }
            assert_eq!(q.build_check_dead_letter_count()?, 1);
            assert!(q.pending_build_checks(now, 100, None)?.is_empty());
            assert!(q.requeue_build_check(b.id, now)?);
            assert!(!q.requeue_build_check(b.id, now)?);
            assert!(!q.deliver_build_check(b.id, 5, 1)?);
            assert!(!q.retry_build_check(b.id, 5, true, now, now)?);
            let c = q.claim_build_check(b.id, 6, now)?.unwrap();
            assert_eq!(c.permanent_failures, 0);
            q.bump_build_check(b.id, now)?;
            assert!(q.retry_build_check(b.id, c.attempts, true, now, now)?);
            assert_eq!(
                q.pending_build_checks(now, 100, None)?[0].permanent_failures,
                1
            );
            assert_eq!(q.build_check_dead_letter_count()?, 0);
            Ok(())
        }))
        .unwrap();
}
