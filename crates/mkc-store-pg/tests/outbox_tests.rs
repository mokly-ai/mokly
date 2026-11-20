//! Real Postgres due-time, dead-letter and optimistic-attempt fencing.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use chrono::{Duration, Utc};
use diesel::prelude::*;
use diesel::sql_types::Text;
use diesel::{Connection, PgConnection, QueryableByName};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::store::Callback;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

#[derive(QueryableByName)]
struct Predicate {
    #[diesel(sql_type = Text)]
    predicate: String,
}

#[test]
fn retention_index_matches_candidate_lifecycle_predicate() {
    let Some(schema) = ScratchSchema::create("outbox_index") else {
        return;
    };
    let migrations: &dyn MigrationRunner = &DieselMigrations;
    migrations.migrate(schema.scoped_url()).unwrap();
    let mut connection = PgConnection::establish(schema.scoped_url()).unwrap();
    let predicate = diesel::sql_query("SELECT pg_get_expr(indpred, indrelid) AS predicate FROM pg_index WHERE indexrelid = 'publications_retention'::regclass")
        .get_result::<Predicate>(&mut connection).unwrap();
    assert_eq!(predicate.predicate, "(state <> 'expired'::text)");
}

#[test]
fn only_due_events_are_selected_and_stale_failures_do_not_consume_attempts() {
    let Some(schema) = ScratchSchema::create("outbox") else {
        return;
    };
    let url = schema.scoped_url().to_owned();
    let migrations: &dyn MigrationRunner = &DieselMigrations;
    migrations.migrate(&url).unwrap();
    let factory: &dyn StoreFactory = &PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    };
    let store = factory.connect(&url).unwrap();
    let now = Utc::now();
    let org = Organization {
        id: Uuid::now_v7().into(),
        name: "Outbox".into(),
        slug: format!("o-{}", Uuid::now_v7().simple()).parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: org.id,
        name: "Outbox".into(),
        slug: format!("p-{}", Uuid::now_v7().simple()).parse().unwrap(),
        repository: "test/outbox".into(),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Private,
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
        deadline: now + Duration::minutes(15),
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
            q.insert_organization(&org)?;
            q.insert_project(&project)?;
            q.insert_publication(&publication)?;
            q.insert_publication_event(&event)?;
            let other_project = Project {
                id: Uuid::now_v7().into(),
                slug: format!("p-{}", Uuid::now_v7().simple()).parse().unwrap(),
                config_path: "other.config.ts".into(),
                ..project.clone()
            };
            let other_publication = Publication {
                id: Uuid::now_v7().into(),
                project_id: other_project.id,
                ..publication.clone()
            };
            q.insert_project(&other_project)?;
            q.insert_publication(&other_publication)?;
            q.insert_publication_event(&PublicationEvent {
                id: Uuid::from_u128(event.id.as_u128() - 1),
                publication_id: other_publication.id,
                ..event.clone()
            })?;
            let unscoped = q.pending_publication_events(now, 1000, None)?;
            for publication_id in [publication.id, other_publication.id] {
                assert!(
                    unscoped
                        .iter()
                        .any(|pending| pending.event.publication_id == publication_id),
                    "unscoped delivery must include each project's event"
                );
            }
            let scoped = q.pending_publication_events(now, 1, Some(project.id))?;
            assert_eq!(scoped.len(), 1);
            assert_eq!(scoped[0].event.id, event.id);
            let pending = q.pending_publication_events(now, 1000, Some(project.id))?;
            assert_eq!(
                pending
                    .iter()
                    .find(|p| p.event.id == event.id)
                    .unwrap()
                    .attempts,
                0
            );
            assert!(
                q.claim_publication_event(event.id, 0, now, now + Duration::minutes(5))?
                    .is_some()
            );
            assert!(q.retry_publication_event(event.id, 1, 1, now + Duration::minutes(1), None)?);
            assert!(!q.retry_publication_event(
                event.id,
                0,
                5,
                now + Duration::hours(1),
                Some(now)
            )?);
            assert!(
                !q.pending_publication_events(now, 1000, Some(project.id))?
                    .iter()
                    .any(|p| p.event.id == event.id)
            );
            let due = now + Duration::minutes(1);
            let pending = q.pending_publication_events(due, 1000, Some(project.id))?;
            assert_eq!(
                pending
                    .iter()
                    .find(|p| p.event.id == event.id)
                    .unwrap()
                    .attempts,
                1
            );
            assert!(
                q.claim_publication_event(event.id, 1, due, due + Duration::minutes(5))?
                    .is_some()
            );
            assert!(q.retry_publication_event(event.id, 2, 1, due, None)?);
            assert_eq!(
                q.pending_publication_events(due, 1000, Some(project.id))?
                    .iter()
                    .find(|p| p.event.id == event.id)
                    .unwrap()
                    .permanent_failures,
                1
            );
            for version in 2..=5 {
                assert!(
                    q.claim_publication_event(event.id, version, due, due + Duration::minutes(5))?
                        .is_some()
                );
                q.retry_publication_event(
                    event.id,
                    version + 1,
                    version,
                    due,
                    (version == 5).then_some(due),
                )?;
            }
            assert!(
                !q.pending_publication_events(due + Duration::days(365), 1000, Some(project.id))?
                    .iter()
                    .any(|p| p.event.id == event.id)
            );
            let dead_letters = q.dead_letter_count()?;
            assert!(dead_letters >= 1);
            assert!(q.requeue_publication_event(event.id, now)?);
            assert_eq!(q.dead_letter_count()?, dead_letters - 1);
            assert!(!q.requeue_publication_event(event.id, now)?);
            assert!(!q.retry_publication_event(event.id, 5, 5, due, Some(due))?);
            let pending = q.pending_publication_events(now, 1000, Some(project.id))?;
            let recovered = pending.iter().find(|p| p.event.id == event.id).unwrap();
            assert_eq!(recovered.permanent_failures, 0);
            assert_eq!(recovered.attempts, 7);
            let claim = q
                .claim_publication_event(event.id, 7, now, now + Duration::minutes(5))?
                .unwrap();
            assert!(q.deliver_publication_event(event.id, claim.attempts, now)?);
            assert_eq!(q.dead_letter_count()?, dead_letters - 1);
            assert!(!q.requeue_publication_event(event.id, now)?);
            assert!(!q.requeue_publication_event(Uuid::nil(), now)?);
            q.delete_organization(org.id)
        }))
        .unwrap();
}
