//! Migrated Postgres, real transactions and provider-free build execution.

use std::sync::Arc;

use diesel::{Connection, PgConnection};
use mkc_auth::runtime::{Runtime, SystemRuntime};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::values::{Plan, Visibility};
use mkc_file_store_interface::store::FileStore;
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory};
use mkc_github_interface::credentials::{Secret, Tokens, TokensMock};
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::{Callback, Queries, Store};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use tempfile::TempDir;
use unimock::{MockFn, Unimock, matching};

use mkc_build_interface::runner::BuildRunner;
use mkc_publications::build_worker::service::{
    BuildWorker, BuildWorkerConfig, BuildWorkerFactory, DatabaseBuildWorkerFactory,
    TokioBuildLeaseClock,
};
use mkc_publications::transaction::{StoreTransactions, Transactions};

pub(super) struct Fixture {
    pub(super) store: Arc<dyn Store>,
    pub(super) transactions: Arc<dyn Transactions>,
    pub(super) project: Project,
    pub(super) repository: Repository,
    pub(super) runtime: Arc<dyn Runtime>,
    pub(super) files: Arc<dyn FileStore>,
    pub(super) file_root: Arc<TempDir>,
    schema: ScratchSchema,
}

impl Fixture {
    pub(super) fn connection(&self) -> PgConnection {
        PgConnection::establish(self.schema.scoped_url()).unwrap()
    }

    pub(super) fn create() -> Option<Self> {
        Self::create_with_runtime(Arc::new(SystemRuntime))
    }

    pub(super) fn create_with_runtime(runtime: Arc<dyn Runtime>) -> Option<Self> {
        let schema = ScratchSchema::create("build_worker")?;
        DieselMigrations.migrate(schema.scoped_url()).unwrap();
        let store = PgStoreFactory {
            runtime: Arc::new(runtime::SystemRuntime),
        }
        .connect(schema.scoped_url())
        .unwrap();
        let organization = Organization {
            id: runtime.id().into(),
            name: "Builds".into(),
            slug: "builds".parse().unwrap(),
            version: 1,
            created_at: runtime.now(),
            plan: Plan::Free,
        };
        let project = Project {
            id: runtime.id().into(),
            organization_id: organization.id,
            name: "Builds".into(),
            slug: "builds".parse().unwrap(),
            repository: "octocat/builds".into(),
            config_path: "mokly.config.json".into(),
            visibility: Visibility::Public,
            require_approval: false,
            automatic_builds: true,
            version: 1,
        };
        let installation = Installation {
            id: runtime.id().into(),
            github_id: 1,
            app_id: 123,
            organization_id: Some(organization.id),
            account_id: 100,
            account_name: "octocat".into(),
            account_kind: AccountKind::Organization,
            manage_url: "https://github.com/settings/installations/1".into(),
            active: true,
            connected: true,
            updated_at: runtime.now(),
        };
        let repository = Repository {
            id: runtime.id().into(),
            installation_id: installation.id,
            github_id: 100,
            full_name: project.repository.clone(),
            default_branch: "main".into(),
            private: false,
            active: true,
        };
        store
            .transaction(&mut Callback(&mut |queries| {
                queries.insert_organization(&organization)?;
                queries.insert_project(&project)?;
                queries.save_github_installation(&installation)?;
                queries.save_github_repository(&repository)?;
                queries.link_github_project(project.id, repository.id)
            }))
            .unwrap();
        let file_root = Arc::new(tempfile::tempdir().unwrap());
        let files = LocalFileStoreFactory.open(file_root.path()).unwrap();
        Some(Self {
            transactions: Arc::new(StoreTransactions {
                store: store.clone(),
            }),
            store,
            project,
            repository,
            runtime,
            files,
            file_root,
            schema,
        })
    }

    pub(super) fn queries(&self, operation: &mut dyn FnMut(&mut dyn Queries)) {
        self.store
            .transaction(&mut Callback(&mut |queries| {
                operation(queries);
                Ok(())
            }))
            .unwrap();
    }

    pub(super) fn worker(
        &self,
        runner: Arc<dyn BuildRunner>,
        limit: usize,
    ) -> Arc<dyn BuildWorker> {
        let credentials = Arc::new(Unimock::new(
            TokensMock::repository_read
                .each_call(matching!(1, 100))
                .answers(&|_, _, _| Ok(Secret::new("scoped-installation".into()))),
        ));
        self.configured_worker(runner, credentials, limit)
    }

    pub(super) fn claim_worker(&self, limit: usize) -> Arc<dyn BuildWorker> {
        self.configured_worker(
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            limit,
        )
    }

    fn configured_worker(
        &self,
        runner: Arc<dyn BuildRunner>,
        credentials: Arc<dyn Tokens>,
        limit: usize,
    ) -> Arc<dyn BuildWorker> {
        DatabaseBuildWorkerFactory {
            transactions: self.transactions.clone(),
            runtime: self.runtime.clone(),
            runner,
            credentials,
            clock: Arc::new(TokioBuildLeaseClock),
        }
        .create(BuildWorkerConfig {
            api_origin: "https://api.example.com".into(),
            per_process: limit,
        })
    }
}
