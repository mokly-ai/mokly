//! Due times, organization limits, recovery and stale attempt fences.

use chrono::Duration;
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildStep};
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::support::{attempt, finish, fixture};

#[test]
fn claims_order_due_times_and_limit_live_organization_leases() {
    let Some(f) = fixture() else {
        return;
    };
    let builds: Vec<_> = (0..3).map(|i| f.build(&format!("branch-{i}"), i)).collect();
    for b in &builds {
        f.schedule(b);
    }
    let a = attempt(f.now);
    f.store
        .transaction(&mut Callback(&mut |q| {
            assert!(q.claim_build(&|| f.now - Duration::seconds(1))?.is_none());
            for b in &builds[..2] {
                assert_eq!(q.claim_build(&|| f.now)?.unwrap().id, b.id);
                assert!(q.start_build(b.id, &a)?.is_some());
            }
            assert!(q.claim_build(&|| f.now)?.is_none());
            assert!(q.start_build(builds[2].id, &a)?.is_none());
            assert!(q.renew_build(
                builds[0].id,
                a.lease_token,
                &|| f.now,
                (f.now + Duration::minutes(3)) - (f.now)
            )?);
            assert!(!q.renew_build(
                builds[0].id,
                Uuid::now_v7(),
                &|| f.now,
                (f.now + Duration::minutes(3)) - (f.now)
            )?);
            assert!(q.set_build_step(builds[0].id, a.lease_token, BuildStep::Install, f.now)?);
            assert!(!q.set_build_step(builds[0].id, Uuid::now_v7(), BuildStep::Publish, f.now)?);
            assert_eq!(q.build_operation(builds[0].id)?, Some(a.operation_id));
            Ok(())
        }))
        .unwrap();
}

#[test]
fn expired_lease_recovers_then_fences_the_older_worker() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let old = attempt(f.now);
    let mut retry = finish(f.now + Duration::minutes(2), BuildState::Queued);
    retry.next_attempt_at = retry.at + Duration::seconds(60);
    let new = attempt(retry.next_attempt_at);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &old)?.unwrap();
            assert!(
                q.claim_build(&|| retry.at - Duration::seconds(1))?
                    .is_none()
            );
            let expired = q.claim_build(&|| retry.at)?.unwrap();
            assert_eq!(expired.id, b.id);
            assert_eq!(expired.lease_token, Some(old.lease_token));
            assert!(q.finish_build(b.id, old.lease_token.into(), &retry)?);
            assert!(q.claim_build(&|| retry.at)?.is_none());
            q.claim_build(&|| new.now)?.unwrap();
            q.start_build(b.id, &new)?.unwrap();
            assert_eq!(q.build(f.project.id, b.id)?.unwrap().attempt, 2);
            assert!(!q.renew_build(
                b.id,
                old.lease_token,
                &|| new.now,
                (new.lease_expires_at) - (new.now)
            )?);
            assert!(!q.finish_build(b.id, Some(old.lease_token), &retry)?);
            let mut fail = finish(new.now, BuildState::Failed);
            fail.failure_cause = Some(BuildFailure::Infrastructure);
            assert!(q.finish_build(b.id, Some(new.lease_token), &fail)?);
            assert!(q.build_operation(b.id)?.is_none());
            assert!(q.claim_build(&|| new.now)?.is_none());
            assert!(!q.finish_build(b.id, Some(new.lease_token), &fail)?);
            Ok(())
        }))
        .unwrap();
}

#[test]
fn cancel_is_scoped_idempotent_and_stops_lease_writes() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?.unwrap();
            assert!(
                q.cancel_build(Uuid::now_v7().into(), b.id, f.now)?
                    .is_none()
            );
            let first = q.cancel_build(f.project.id, b.id, f.now)?.unwrap();
            assert_eq!(first.state, BuildState::Cancelled);
            assert!(first.log_complete);
            let second = q
                .cancel_build(f.project.id, b.id, f.now + Duration::seconds(1))?
                .unwrap();
            assert_eq!(first.finished_at, second.finished_at);
            assert!(!q.renew_build(
                b.id,
                a.lease_token,
                &|| f.now,
                (a.lease_expires_at) - (f.now)
            )?);
            Ok(())
        }))
        .unwrap();
}

#[test]
fn queued_rejection_can_fail_but_cannot_finish_an_attempt_that_never_started() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    f.store
        .transaction(&mut Callback(&mut |q| {
            let mut timeout = finish(f.now, BuildState::TimedOut);
            timeout.failure_cause = Some(BuildFailure::Idle);
            assert!(!q.finish_build(b.id, None, &timeout)?);
            assert!(!q.finish_build(b.id, None, &finish(f.now, BuildState::Queued))?);
            let mut rejected = finish(f.now, BuildState::Failed);
            rejected.failure_cause = Some(BuildFailure::RepositoryUnavailable);
            assert!(q.finish_build(b.id, None, &rejected)?);
            assert_eq!(q.build(f.project.id, b.id)?.unwrap().attempt, 0);
            Ok(())
        }))
        .unwrap();
}
