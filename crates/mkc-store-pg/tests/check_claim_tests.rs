//! Concurrent check claims, crash recovery and version-fenced outcomes in Postgres.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::{Arc, Barrier};
use std::thread;

use chrono::{DateTime, Duration, Utc};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::publication_event::{EventClaim, EventKind, PublicationEvent};
use mkc_store_interface::store::{Callback, Store};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

struct Fixture {
    store: Arc<dyn Store>,
    event: PublicationEvent,
    now: DateTime<Utc>,
    _schema: ScratchSchema,
}

fn fixture() -> Option<Fixture> {
    let schema = ScratchSchema::create("check_claim")?;
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(schema.scoped_url())
    .unwrap();
    let now = Utc::now();
    let organization = Organization {
        id: Uuid::now_v7().into(),
        name: "Claims".into(),
        slug: "claims".parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: organization.id,
        name: "Claims".into(),
        slug: "claims".parse().unwrap(),
        repository: "test/claims".into(),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Public,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    let publication = Publication {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        metadata: None,
        state: PublicationState::Uploading,
        failure: None,
        changes: None,
        created_at: now,
        deadline: now + Duration::hours(1),
        expired_at: None,
        build_id: None,
        build_failure_event_id: None,
    };
    let event = PublicationEvent {
        id: Uuid::now_v7(),
        publication_id: publication.id,
        kind: EventKind::Rerequest,
        created_at: now,
    };
    store
        .transaction(&mut Callback(&mut |q| {
            q.insert_organization(&organization)?;
            q.insert_project(&project)?;
            q.insert_publication(&publication)?;
            q.insert_publication_event(&event)
        }))
        .unwrap();
    Some(Fixture {
        store,
        event,
        now,
        _schema: schema,
    })
}

#[test]
fn competing_claims_have_one_winner_and_reclaim_rejects_both_stale_outcomes() {
    let Some(f) = fixture() else {
        return;
    };
    let start = Arc::new(Barrier::new(2));
    let workers: Vec<_> = (0..2)
        .map(|_| {
            let store = f.store.clone();
            let start = start.clone();
            let (id, now) = (f.event.id, f.now);
            thread::spawn(move || {
                start.wait();
                let mut claim = None;
                store
                    .transaction(&mut Callback(&mut |q| {
                        claim =
                            q.claim_publication_event(id, 0, now, now + Duration::minutes(5))?;
                        Ok(())
                    }))
                    .unwrap();
                claim
            })
        })
        .collect();
    let winners: Vec<_> = workers
        .into_iter()
        .filter_map(|worker| worker.join().unwrap())
        .collect();
    assert_eq!(
        winners,
        vec![EventClaim {
            attempts: 1,
            permanent_failures: 0
        }]
    );
    f.store
        .transaction(&mut Callback(&mut |q| {
            let (id, now) = (f.event.id, f.now);
            assert!(q.pending_publication_events(now, 100, None)?.is_empty());
            assert!(
                q.claim_publication_event(id, 1, now, now + Duration::minutes(5))?
                    .is_none()
            );
            let lapse = now + Duration::minutes(5);
            let pending = q.pending_publication_events(lapse, 100, None)?;
            assert_eq!(pending.len(), 1);
            assert_eq!((pending[0].attempts, pending[0].permanent_failures), (1, 0));
            assert!(
                q.claim_publication_event(id, 0, lapse, lapse + Duration::minutes(5))?
                    .is_none()
            );
            let reclaimed = q
                .claim_publication_event(id, 1, lapse, lapse + Duration::minutes(5))?
                .unwrap();
            assert_eq!(
                reclaimed,
                EventClaim {
                    attempts: 2,
                    permanent_failures: 0
                }
            );
            assert!(!q.deliver_publication_event(id, 1, lapse)?);
            assert!(!q.retry_publication_event(id, 1, 5, lapse, Some(lapse))?);
            assert!(q.pending_publication_events(lapse, 100, None)?.is_empty());
            assert_eq!(q.dead_letter_count()?, 0);
            assert!(q.deliver_publication_event(id, 2, lapse)?);
            assert!(!q.retry_publication_event(id, 2, 5, lapse, Some(lapse))?);
            assert!(
                q.claim_publication_event(id, 2, lapse, lapse + Duration::minutes(5))?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
}

#[test]
fn claims_preserve_backoff_budget_dead_letters_and_operator_requeue() {
    let Some(f) = fixture() else {
        return;
    };
    f.store
        .transaction(&mut Callback(&mut |q| {
            let id = f.event.id;
            let mut now = f.now;
            for (observed, delay) in [60, 120, 240, 480, 960].into_iter().enumerate() {
                let observed = observed as i32;
                let claim = q
                    .claim_publication_event(id, observed, now, now + Duration::minutes(5))?
                    .unwrap();
                assert_eq!(
                    claim,
                    EventClaim {
                        attempts: observed + 1,
                        permanent_failures: observed
                    }
                );
                let due = now + Duration::seconds(delay);
                assert!(q.retry_publication_event(
                    id,
                    claim.attempts,
                    observed + 1,
                    due,
                    (observed == 4).then_some(now)
                )?);
                assert!(
                    q.pending_publication_events(due - Duration::seconds(1), 100, None)?
                        .is_empty()
                );
                let pending = q.pending_publication_events(due, 100, None)?;
                if observed < 4 {
                    assert_eq!(pending.len(), 1);
                    assert_eq!(
                        (pending[0].attempts, pending[0].permanent_failures),
                        (observed + 1, observed + 1)
                    );
                } else {
                    assert!(pending.is_empty());
                }
                now = due;
            }
            assert_eq!(q.dead_letter_count()?, 1);
            assert!(
                q.claim_publication_event(id, 5, now, now + Duration::minutes(5))?
                    .is_none()
            );
            assert!(q.requeue_publication_event(id, now)?);
            assert!(!q.deliver_publication_event(id, 5, now)?);
            assert!(!q.retry_publication_event(id, 5, 5, now, Some(now))?);
            let claim = q
                .claim_publication_event(id, 6, now, now + Duration::minutes(5))?
                .unwrap();
            assert_eq!(
                claim,
                EventClaim {
                    attempts: 7,
                    permanent_failures: 0
                }
            );
            let capped = now + Duration::hours(1);
            assert!(q.retry_publication_event(id, claim.attempts, 0, capped, None)?);
            assert!(
                q.pending_publication_events(capped - Duration::seconds(1), 100, None)?
                    .is_empty()
            );
            let pending = q.pending_publication_events(capped, 100, None)?;
            assert_eq!((pending[0].attempts, pending[0].permanent_failures), (7, 0));
            assert_eq!(q.dead_letter_count()?, 0);
            Ok(())
        }))
        .unwrap();
}
