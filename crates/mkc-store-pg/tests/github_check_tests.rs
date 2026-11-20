//! Check identity conflicts, bounded rerequests and atomic outbox effects in Postgres.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::{Arc, mpsc};
use std::thread;
use std::time;

use chrono::{Duration, Utc};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::error::Error;
use mkc_store_interface::github_check::CheckRun;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::store::{Callback, Store};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

struct Fixture {
    store: Arc<dyn Store>,
    check: CheckRun,
    publication: Publication,
    _schema: ScratchSchema,
}

fn fixture() -> Option<Fixture> {
    let schema = ScratchSchema::create("github_checks")?;
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(schema.scoped_url())
    .unwrap();
    let now = Utc::now();
    let org = Organization {
        id: Uuid::now_v7().into(),
        name: "Checks".into(),
        slug: "checks".parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: org.id,
        name: "Checks".into(),
        slug: "checks".parse().unwrap(),
        repository: "test/checks".into(),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Public,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    let installation = Installation {
        id: Uuid::now_v7().into(),
        github_id: 1,
        app_id: 123,
        organization_id: Some(org.id),
        account_id: 1,
        account_name: "test".into(),
        account_kind: AccountKind::Organization,
        manage_url: "https://github.com/settings/installations/1".into(),
        active: true,
        connected: true,
        updated_at: now,
    };
    let repository = Repository {
        id: Uuid::now_v7().into(),
        installation_id: installation.id,
        github_id: 1,
        full_name: "test/checks".into(),
        default_branch: "main".into(),
        private: false,
        active: true,
    };
    let publication = Publication {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        metadata: None,
        state: PublicationState::Uploading,
        failure: None,
        changes: None,
        created_at: now,
        deadline: now + Duration::minutes(60),
        expired_at: None,
        build_id: None,
        build_failure_event_id: None,
    };
    let check = CheckRun {
        id: Uuid::now_v7(),
        project_id: project.id,
        repository_id: repository.id,
        github_id: 4,
        head_sha: "a".repeat(40),
        external_id: format!("mokly-publication:{}", publication.id),
        rerequested: true,
    };
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_organization(&org)?;
            queries.insert_project(&project)?;
            queries.save_github_installation(&installation)?;
            queries.save_github_repository(&repository)?;
            queries.link_github_project(project.id, repository.id)?;
            queries.insert_publication(&publication)?;
            queries.save_github_check(&check)
        }))
        .unwrap();
    Some(Fixture {
        store,
        check,
        publication,
        _schema: schema,
    })
}

#[test]
fn recording_recovery_preserves_the_mark_and_rejects_conflicting_identity() {
    let Some(fixture) = fixture() else {
        return;
    };
    let recovered = CheckRun {
        id: Uuid::now_v7(),
        rerequested: false,
        ..fixture.check.clone()
    };
    fixture
        .store
        .transaction(&mut Callback(&mut |queries| {
            queries.record_github_check(&recovered)?;
            let row = queries
                .github_check_by_external_id(recovered.project_id, &recovered.external_id)?
                .unwrap();
            assert_eq!(row.id, fixture.check.id);
            assert!(row.rerequested);
            assert!(
                queries
                    .github_check_by_external_id(Uuid::now_v7().into(), &recovered.external_id)?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
    let conflicting = CheckRun {
        head_sha: "b".repeat(40),
        ..recovered
    };
    assert!(
        fixture
            .store
            .transaction(&mut Callback(
                &mut |queries| queries.record_github_check(&conflicting)
            ))
            .is_err()
    );
    fixture
        .store
        .read(&mut Callback(&mut |queries| {
            assert_eq!(
                queries.github_check(4)?.unwrap().head_sha,
                fixture.check.head_sha
            );
            Ok(())
        }))
        .unwrap();
}

#[test]
fn rerequest_mark_and_fresh_event_roll_back_together() {
    let Some(fixture) = fixture() else {
        return;
    };
    let event = PublicationEvent {
        id: Uuid::now_v7(),
        publication_id: fixture.publication.id,
        kind: EventKind::Rerequest,
        created_at: Utc::now(),
    };
    assert!(
        fixture
            .store
            .transaction(&mut Callback(&mut |queries| {
                let rows = queries.rerequested_github_checks("mokly-publication:", 100)?;
                assert_eq!(rows.len(), 1);
                queries.insert_publication_event(&event)?;
                queries.clear_github_check_rerequest(rows[0].id)?;
                Err(Error::internal(std::io::Error::other(
                    "abort both query effects",
                )))
            }))
            .is_err()
    );
    fixture
        .store
        .transaction(&mut Callback(&mut |queries| {
            assert!(queries.github_check(4)?.unwrap().rerequested);
            assert!(
                queries
                    .pending_publication_events(Utc::now(), 100, None)?
                    .is_empty()
            );
            queries.insert_publication_event(&event)?;
            queries.clear_github_check_rerequest(fixture.check.id)?;
            assert!(!queries.github_check(4)?.unwrap().rerequested);
            let events = queries.pending_publication_events(Utc::now(), 100, None)?;
            assert_eq!(events.len(), 1);
            assert_eq!((events[0].attempts, events[0].permanent_failures), (0, 0));
            Ok(())
        }))
        .unwrap();
}

#[test]
fn bounded_batches_preserve_build_marks_and_skip_another_workers_locks() {
    let Some(fixture) = fixture() else {
        return;
    };
    fixture
        .store
        .transaction(&mut Callback(&mut |queries| {
            for index in 0..101 {
                queries.save_github_check(&CheckRun {
                    id: Uuid::now_v7(),
                    github_id: 10 + index,
                    external_id: format!("mokly-publication:{index}"),
                    ..fixture.check.clone()
                })?;
            }
            queries.save_github_check(&CheckRun {
                id: Uuid::now_v7(),
                github_id: 500,
                external_id: "mokly-build:future".into(),
                ..fixture.check.clone()
            })
        }))
        .unwrap();
    let (locked, locks) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let store = fixture.store.clone();
    let other = thread::spawn(move || {
        store
            .transaction(&mut Callback(&mut |queries| {
                let rows = queries.rerequested_github_checks("mokly-publication:", 1000)?;
                assert_eq!(rows.len(), 100);
                assert!(rows.windows(2).all(|pair| pair[0].id < pair[1].id));
                locked.send(()).unwrap();
                released.recv().unwrap();
                for row in rows {
                    queries.clear_github_check_rerequest(row.id)?;
                }
                Ok(())
            }))
            .unwrap();
    });
    locks.recv_timeout(time::Duration::from_secs(10)).unwrap();
    fixture
        .store
        .transaction(&mut Callback(&mut |queries| {
            assert!(
                queries
                    .rerequested_github_checks("mokly-publication:", 100)?
                    .is_empty()
            );
            assert!(queries.github_check(500)?.unwrap().rerequested);
            Ok(())
        }))
        .unwrap();
    release.send(()).unwrap();
    other.join().unwrap();
    fixture
        .store
        .transaction(&mut Callback(&mut |queries| {
            let remaining = queries.rerequested_github_checks("mokly-publication:", 100)?;
            assert_eq!(remaining.len(), 2);
            assert!(queries.github_check(500)?.unwrap().rerequested);
            Ok(())
        }))
        .unwrap();
}
