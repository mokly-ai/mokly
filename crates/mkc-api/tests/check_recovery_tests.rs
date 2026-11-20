//! Operator CLI recovers an outbox row without a provider check or API settings.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::process::Command;
use std::sync::Arc;

use chrono::{Duration, Utc};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationFailure, PublicationState};
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::store::Callback;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

#[test]
fn operator_requeues_a_dead_letter_with_database_configuration_only() {
    let Some(schema) = ScratchSchema::create("check_recovery") else {
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
    let workspace = Organization {
        id: Uuid::now_v7().into(),
        name: "Recovery test".into(),
        slug: format!("r-{}", Uuid::now_v7().simple()).parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: workspace.id,
        name: "Recovery test".into(),
        slug: format!("recovery-{}", Uuid::now_v7().simple())
            .parse()
            .unwrap(),
        repository: "test/recovery".into(),
        config_path: "mokly.config.json".into(),
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
        kind: EventKind::Failed,
        created_at: now,
    };
    store
        .transaction(&mut Callback(&mut |q| {
            q.insert_organization(&workspace)?;
            q.insert_project(&project)?;
            q.insert_publication(&publication)?;
            assert!(q.fail_publication(publication.id, PublicationFailure::Internal)?);
            q.insert_publication_event(&event)?;
            for attempt in 0..5 {
                assert!(
                    q.claim_publication_event(event.id, attempt, now, now + Duration::minutes(5))?
                        .is_some()
                );
                q.retry_publication_event(
                    event.id,
                    attempt + 1,
                    attempt + 1,
                    now,
                    (attempt == 4).then_some(now),
                )?;
            }
            Ok(())
        }))
        .unwrap();
    for (id, expected) in [(event.id, true), (event.id, false), (Uuid::nil(), false)] {
        let output = Command::new("timeout")
            .args([
                "30",
                env!("CARGO_BIN_EXE_mkc-api"),
                "requeue-publication-check",
                "--event",
                &id.to_string(),
            ])
            .env_clear()
            .env("MKC_DATABASE_URL", &url)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(
            String::from_utf8_lossy(&output.stdout).contains(&format!("\"requeued\":{expected}"))
        );
    }
    store
        .transaction(&mut Callback(&mut |q| {
            let pending = q.pending_publication_events(Utc::now(), 1000, None)?;
            let recovered = pending.iter().find(|p| p.event.id == event.id).unwrap();
            assert_eq!(recovered.permanent_failures, 0);
            assert_eq!(recovered.attempts, 6);
            assert_eq!(
                q.publication(publication.id)?.unwrap().state,
                PublicationState::Failed
            );
            q.delete_organization(workspace.id)
        }))
        .unwrap();
}
