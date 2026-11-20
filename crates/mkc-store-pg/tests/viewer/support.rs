//! Unique database fixtures rolled back after each integration scenario.

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::ids::ProjectId;
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::error::Result;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationMetadata, PublicationState,
};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::{Decision, Queries, Transaction};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use uuid::Uuid;

pub(super) struct Fixture {
    pub(super) project: ProjectId,
    pub(super) other: ProjectId,
    pub(super) repository: Repository,
}

impl Fixture {
    pub(super) fn publication(
        &self,
        id: u128,
        branch: &str,
        seconds: i64,
        state: PublicationState,
    ) -> Publication {
        Publication {
            id: Uuid::from_u128(self.project.0.as_u128() + id).into(),
            project_id: self.project,
            metadata: Some(PublicationMetadata {
                branch: branch.into(),
                head_sha: format!("{id:040x}"),
                base_ref: None,
                base_sha: None,
                pull_request: Some(7),
                config_path: "mokly.config.ts".into(),
                exported_at: time(-seconds),
            }),
            state,
            changes: matches!(state, PublicationState::Ready | PublicationState::Expired)
                .then_some(Changes::NoComparison),
            failure: (state == PublicationState::Failed)
                .then_some(PublicationFailure::InvalidBundle),
            created_at: time(seconds),
            deadline: time(seconds) + Duration::minutes(15),
            expired_at: (state == PublicationState::Expired).then(|| time(seconds + 1)),
            build_id: None,
            build_failure_event_id: None,
        }
    }
}

pub(super) fn time(seconds: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(1_700_000_000 + seconds, 0).unwrap()
}

struct Scenario<'a>(&'a mut dyn FnMut(&mut dyn Queries, &Fixture) -> Result<()>);

impl Transaction for Scenario<'_> {
    fn run(&mut self, queries: &mut dyn Queries) -> Result<Decision> {
        let org = Organization {
            id: Uuid::now_v7().into(),
            name: "Viewer persistence".into(),
            slug: format!("o-{}", Uuid::now_v7().simple()).parse().unwrap(),
            version: 1,
            created_at: time(0),
            plan: Plan::Free,
        };
        queries.insert_organization(&org)?;
        let mut project = Project {
            id: Uuid::now_v7().into(),
            organization_id: org.id,
            slug: format!("p-{}", Uuid::now_v7().simple()).parse().unwrap(),
            repository: "mokly-ai/mokly-cloud".into(),
            config_path: "mokly.config.ts".into(),
            name: "Viewer".into(),
            visibility: Visibility::Private,
            require_approval: false,
            automatic_builds: false,
            version: 1,
        };
        queries.insert_project(&project)?;
        let project_id = project.id;
        project.id = Uuid::now_v7().into();
        project.slug = format!("p-{}", Uuid::now_v7().simple()).parse().unwrap();
        project.config_path = "other.config.ts".into();
        queries.insert_project(&project)?;
        let installation = Installation {
            id: Uuid::now_v7().into(),
            github_id: (org.id.0.as_u128() & (i64::MAX as u128)) as i64,
            app_id: 1,
            organization_id: Some(org.id),
            account_id: 1,
            account_name: "mokly-ai".into(),
            account_kind: AccountKind::Organization,
            manage_url: "https://github.com/settings/installations/1".into(),
            active: true,
            connected: true,
            updated_at: time(0),
        };
        queries.save_github_installation(&installation)?;
        let repository = Repository {
            id: Uuid::now_v7().into(),
            installation_id: installation.id,
            github_id: 1,
            full_name: "mokly-ai/mokly-cloud".into(),
            default_branch: "main".into(),
            private: true,
            active: true,
        };
        queries.save_github_repository(&repository)?;
        (self.0)(
            queries,
            &Fixture {
                project: project_id,
                other: project.id,
                repository,
            },
        )?;
        Ok(Decision::Rollback)
    }
}

pub(super) fn run(scenario: &mut dyn FnMut(&mut dyn Queries, &Fixture) -> Result<()>) {
    let Some(schema) = ScratchSchema::create("viewer") else {
        return;
    };
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let store = PgStoreFactory {
        runtime: Arc::new(runtime::SystemRuntime),
    }
    .connect(schema.scoped_url())
    .unwrap();
    store.transaction(&mut Scenario(scenario)).unwrap();
}
