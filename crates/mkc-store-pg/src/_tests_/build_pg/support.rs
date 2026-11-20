//! Migrated scratch-schema fixtures and real READ COMMITTED transaction helpers.

use std::sync::Arc;
use std::thread;
use std::time::{Duration as WaitDuration, Instant};

use chrono::{DateTime, Duration, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Bool, Integer};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_attempt::{BuildAttempt, BuildFinish};
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::{Callback, Queries, Store};
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

use crate::connection::{PgStoreFactory, StoreFactory};
use crate::queries::PgQueries;
use crate::runtime::SystemRuntime;

pub(super) struct Fixture {
    pub(super) store: Arc<dyn Store>,
    pub(super) project: Project,
    pub(super) repository: Repository,
    pub(super) now: DateTime<Utc>,
    pub(super) schema: ScratchSchema,
}

pub(super) fn fixture() -> Option<Fixture> {
    let schema = ScratchSchema::create("builds")?;
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(schema.scoped_url())
    .unwrap();
    let now = DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap();
    let org = Organization {
        id: Uuid::now_v7().into(),
        name: "Builds".into(),
        slug: "builds".parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: org.id,
        name: "Builds".into(),
        slug: "builds".parse().unwrap(),
        repository: "test/builds".into(),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Public,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    let installation = Installation {
        id: Uuid::now_v7().into(),
        github_id: 1,
        app_id: 1,
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
        full_name: project.repository.clone(),
        default_branch: "main".into(),
        private: false,
        active: true,
    };
    store
        .transaction(&mut Callback(&mut |q| {
            q.insert_organization(&org)?;
            q.insert_project(&project)?;
            q.save_github_installation(&installation)?;
            q.save_github_repository(&repository)?;
            q.link_github_project(project.id, repository.id)
        }))
        .unwrap();
    Some(Fixture {
        store,
        project,
        repository,
        now,
        schema,
    })
}

impl Fixture {
    pub(super) fn connection(&self) -> PgConnection {
        PgConnection::establish(self.schema.scoped_url()).unwrap()
    }

    pub(super) fn build(&self, branch: &str, head: u32) -> NewBuild {
        NewBuild {
            id: Uuid::now_v7().into(),
            project_id: self.project.id,
            repository_id: self.repository.id,
            trigger: BuildTrigger::Request,
            branch: branch.into(),
            head_sha: format!("{head:040x}"),
            pull_request: None,
            base_ref: None,
            config_path: self.project.config_path.clone(),
            created_at: self.now,
        }
    }

    pub(super) fn schedule(&self, build: &NewBuild) {
        self.store
            .transaction(&mut Callback(&mut |q| q.schedule_build(build)))
            .unwrap();
    }

    pub(super) fn publication(&self, build: &NewBuild) -> Publication {
        Publication {
            id: Uuid::now_v7().into(),
            project_id: build.project_id,
            build_id: Some(build.id),
            build_failure_event_id: Some(uuid::Uuid::now_v7()),
            metadata: Some(PublicationMetadata {
                branch: build.branch.clone(),
                head_sha: build.head_sha.clone(),
                base_ref: None,
                base_sha: None,
                pull_request: build.pull_request,
                config_path: build.config_path.clone(),
                exported_at: self.now,
            }),
            state: PublicationState::Ready,
            failure: None,
            changes: Some(Changes::NoComparison),
            created_at: self.now,
            deadline: self.now + Duration::hours(1),
            expired_at: None,
        }
    }
}

pub(super) fn attempt(now: DateTime<Utc>) -> BuildAttempt {
    BuildAttempt {
        now,
        operation_id: Uuid::now_v7(),
        lease_token: Uuid::now_v7(),
        lease_expires_at: now + Duration::minutes(2),
        deadline_at: now + Duration::minutes(15),
    }
}

pub(super) fn finish(now: DateTime<Utc>, state: BuildState) -> BuildFinish {
    BuildFinish {
        state,
        failure_cause: None,
        exit_code: None,
        at: now,
        next_attempt_at: now,
    }
}

pub(super) fn rc<T>(connection: &mut PgConnection, work: impl FnOnce(&mut dyn Queries) -> T) -> T {
    connection
        .build_transaction()
        .read_committed()
        .run::<_, diesel::result::Error, _>(|connection| Ok(work(&mut PgQueries { connection })))
        .unwrap()
}

#[derive(QueryableByName)]
struct Pid {
    #[diesel(sql_type = Integer)]
    pid: i32,
}

pub(super) fn pid(connection: &mut PgConnection) -> i32 {
    diesel::sql_query("SELECT pg_backend_pid() AS pid")
        .get_result::<Pid>(connection)
        .unwrap()
        .pid
}

#[derive(QueryableByName)]
struct Waiting {
    #[diesel(sql_type = Bool)]
    waiting: bool,
}

pub(super) fn wait_for_lock(connection: &mut PgConnection, pid: i32) {
    let deadline = Instant::now() + WaitDuration::from_secs(10);
    loop {
        let waiting = diesel::sql_query("SELECT cardinality(pg_blocking_pids($1)) > 0 AS waiting")
            .bind::<Integer, _>(pid)
            .get_result::<Waiting>(connection)
            .unwrap()
            .waiting;
        if waiting {
            return;
        }
        assert!(
            Instant::now() < deadline,
            "second transaction must wait on the first connection's lock"
        );
        thread::sleep(WaitDuration::from_millis(5));
    }
}
