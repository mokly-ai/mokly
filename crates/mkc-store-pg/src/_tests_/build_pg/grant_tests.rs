//! Per-attempt grant identity, ranked answers and atomic ready consumption.

use chrono::Duration;
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::build_state::{BuildState, UploadOutcome};
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::support::{attempt, finish, fixture};

pub(super) fn grant(
    build: mkc_domain::ids::BuildId,
    a: &mkc_store_interface::build_attempt::BuildAttempt,
) -> BuildUploadGrant {
    BuildUploadGrant {
        id: Uuid::now_v7(),
        build_id: build,
        attempt: 1,
        token_digest: [7; 32],
        expires_at: a.deadline_at,
        consumed_at: None,
        outcome: None,
        created_at: a.now,
    }
}

#[test]
fn mint_and_consume_bind_the_live_attempt_to_its_ready_head() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let g = grant(b.id, &a);
    let publication = f.publication(&b);
    f.store
        .transaction(&mut Callback(&mut |q| {
            assert!(!q.mint_build_grant(&g)?);
            q.start_build(b.id, &a)?.unwrap();
            let mut wrong = g.clone();
            wrong.expires_at += Duration::seconds(1);
            assert!(!q.mint_build_grant(&wrong)?);
            assert!(q.mint_build_grant(&g)?);
            assert!(!q.mint_build_grant(&g)?);
            assert_eq!(q.build_grant(&g.token_digest)?, Some(g.clone()));
            assert!(q.build_grant(&[8; 32])?.is_none());
            assert_eq!(q.build_attempt_grant(b.id, 1)?, Some(g.clone()));
            assert!(q.build_attempt_grant(b.id, 2)?.is_none());
            assert!(!q.consume_build_grant(g.id, Uuid::now_v7().into(), &|| f.now)?);
            let foreign_head = f.build("other", 2);
            let wrong_publication = f.publication(&foreign_head);
            let mut wrong_publication = wrong_publication;
            wrong_publication.build_id = None;
            q.insert_publication(&wrong_publication)?;
            assert!(!q.consume_build_grant(g.id, wrong_publication.id, &|| f.now)?);
            q.insert_publication(&publication)?;
            assert!(q.consume_build_grant(g.id, publication.id, &|| f.now)?);
            assert!(!q.consume_build_grant(g.id, publication.id, &|| f.now)?);
            let consumed = q.build_grant(&g.token_digest)?.unwrap();
            assert_eq!(consumed.consumed_at, Some(f.now));
            assert_eq!(consumed.outcome, Some(UploadOutcome::Accepted));
            assert_eq!(
                q.build(f.project.id, b.id)?.unwrap().publication_id,
                Some(publication.id)
            );
            assert_eq!(
                q.cancel_build(f.project.id, b.id, f.now)?.unwrap().state,
                BuildState::Running
            );
            assert!(!q.finish_build(
                b.id,
                Some(a.lease_token),
                &finish(f.now, BuildState::Queued)
            )?);
            assert!(q.finish_build(
                b.id,
                Some(a.lease_token),
                &finish(f.now, BuildState::Published)
            )?);
            Ok(())
        }))
        .unwrap();
}

#[test]
fn ranked_outcomes_keep_refusals_through_outages_and_accepted_wins() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let g = grant(b.id, &a);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?.unwrap();
            q.mint_build_grant(&g)?;
            for outcome in [
                UploadOutcome::Unavailable,
                UploadOutcome::Rejected,
                UploadOutcome::PlanRequired,
            ] {
                assert!(q.record_build_upload_outcome(g.id, outcome)?);
            }
            assert!(!q.record_build_upload_outcome(g.id, UploadOutcome::Unavailable)?);
            assert_eq!(
                q.build_grant(&g.token_digest)?.unwrap().outcome,
                Some(UploadOutcome::PlanRequired)
            );
            assert!(q.record_build_upload_outcome(g.id, UploadOutcome::Accepted)?);
            assert!(!q.record_build_upload_outcome(g.id, UploadOutcome::Rejected)?);
            assert_eq!(
                q.build_grant(&g.token_digest)?.unwrap().outcome,
                Some(UploadOutcome::Accepted)
            );
            Ok(())
        }))
        .unwrap();
}

#[test]
fn cancellation_and_lease_or_grant_expiry_refuse_consumption() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let g = grant(b.id, &a);
    let p = f.publication(&b);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?.unwrap();
            q.mint_build_grant(&g)?;
            q.insert_publication(&p)?;
            assert!(!q.consume_build_grant(g.id, p.id, &|| a.lease_expires_at)?);
            assert!(!q.consume_build_grant(g.id, p.id, &|| a.deadline_at)?);
            q.cancel_build(f.project.id, b.id, f.now)?;
            assert!(!q.consume_build_grant(g.id, p.id, &|| f.now)?);
            Ok(())
        }))
        .unwrap();
}
