//! Database-only build retention and fenced check recovery through the binary.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::process::Command;
use std::sync::Arc;

use chrono::{Duration, Utc};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_attempt::BuildFinish;
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildTrigger};
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Callback;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

fn run(url: &str, args: &[&str]) -> String {
    let output = Command::new("timeout")
        .args(["30", env!("CARGO_BIN_EXE_mkc-api")])
        .args(args)
        .env_clear()
        .env("MKC_DATABASE_URL", url)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}

#[test]
fn build_check_recovery_count_and_prune_need_database_configuration_only() {
    let Some(schema) = ScratchSchema::create("build_maintenance") else {
        return;
    };
    let migrations: &dyn MigrationRunner = &DieselMigrations;
    migrations.migrate(schema.scoped_url()).unwrap();
    let factory: &dyn StoreFactory = &PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    };
    let store = factory.connect(schema.scoped_url()).unwrap();
    let now = Utc::now();
    let old = now - Duration::days(31);
    let workspace = Organization {
        id: Uuid::now_v7().into(),
        name: "Build maintenance".into(),
        slug: "build-maintenance".parse().unwrap(),
        version: 1,
        created_at: old,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: workspace.id,
        name: "Build maintenance".into(),
        slug: "build-maintenance".parse().unwrap(),
        repository: "test/builds".into(),
        config_path: "mokly.config.json".into(),
        visibility: Visibility::Public,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    let installation = Installation {
        id: Uuid::now_v7().into(),
        github_id: 1,
        app_id: 123,
        organization_id: Some(workspace.id),
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
        full_name: project.repository.clone(),
        default_branch: "main".into(),
        private: false,
        active: true,
    };
    let build = NewBuild {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        repository_id: repository.id,
        trigger: BuildTrigger::Push,
        branch: "main".into(),
        head_sha: "a".repeat(40),
        pull_request: None,
        base_ref: None,
        config_path: project.config_path.clone(),
        created_at: old,
    };
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_organization(&workspace)?;
            queries.insert_project(&project)?;
            queries.save_github_installation(&installation)?;
            queries.save_github_repository(&repository)?;
            queries.schedule_build(&build)?;
            assert!(queries.finish_build(
                build.id,
                None,
                &BuildFinish {
                    state: BuildState::Failed,
                    failure_cause: Some(BuildFailure::RepositoryUnavailable),
                    exit_code: None,
                    at: old,
                    next_attempt_at: old
                }
            )?);
            for attempt in 0..5 {
                assert!(queries.claim_build_check(build.id, attempt, now)?.is_some());
                assert!(queries.retry_build_check(build.id, attempt + 1, true, now, now)?);
            }
            Ok(())
        }))
        .unwrap();
    assert!(
        run(schema.scoped_url(), &["publication-check-status"]).contains("\"dead_letter_count\":1")
    );
    let id = build.id.to_string();
    for expected in [true, false] {
        assert!(
            run(
                schema.scoped_url(),
                &["requeue-build-check", "--build", &id]
            )
            .contains(&format!("\"requeued\":{expected}"))
        );
    }
    assert!(
        run(schema.scoped_url(), &["publication-check-status"]).contains("\"dead_letter_count\":0")
    );
    store
        .transaction(&mut Callback(&mut |queries| {
            assert!(!queries.deliver_build_check(build.id, 5, 1)?);
            assert!(!queries.retry_build_check(build.id, 5, true, now, now)?);
            let pending =
                queries.pending_build_checks(now + Duration::minutes(1), 100, Some(project.id))?;
            assert_eq!(pending[0].attempts, 6);
            assert_eq!(pending[0].permanent_failures, 0);
            assert!(pending[0].claim_expires_at.is_none());
            Ok(())
        }))
        .unwrap();
    assert!(run(schema.scoped_url(), &["prune"]).contains("\"builds\":1"));
    store
        .read(&mut Callback(&mut |queries| {
            assert!(queries.build(project.id, build.id)?.is_none());
            assert!(
                queries
                    .pending_build_checks(now, 100, Some(project.id))?
                    .is_empty()
            );
            Ok(())
        }))
        .unwrap();
}
