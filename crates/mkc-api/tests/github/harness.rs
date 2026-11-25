//! Isolated native Postgres schema and a real API server with bounded shutdown.

use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use chrono::Utc;
use mkc_api::application::{ApplicationFactory, ConfiguredApplicationFactory};
use mkc_api::billing_providers::SystemBillingProviderFactory;
use mkc_api::build_providers::{BuildProviderFactory, SystemBuildProviderFactory};
use mkc_api::github_providers::SystemGitHubProviderFactory;
use mkc_domain::ids::UserId;
use mkc_github_double::server::RecordedGitHub;
use mkc_store_interface::store::{Callback, Queries, Store};
use mkc_store_interface::user::User;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use reqwest::Method;
use reqwest::blocking::Client;
use sandbox_interface::SandboxLifecycleMock;
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::contract_client::{ContractRequest, ContractResponse};
use crate::test_server::{BoundListener, ServerThread};

use super::build_provider::{RecordedBuildProviders, RunMode, RunRecords};
use super::harness_settings::settings;

pub(super) const APP: &str = "https://app.example.com";
pub(super) const SECRET: &str = "fixture-webhook-secret-with-32-bytes";

/// Each scenario opens multiple real pools; keep the suite within default Postgres limits.
static DATABASE_SCENARIO: Mutex<()> = Mutex::new(());

pub(super) struct Harness {
    /// Stop workers before the double, mock, store, schema and database lock drop.
    _server: ServerThread,
    pub(super) github: RecordedGitHub,
    pub(super) build_requests: RunRecords,
    _build_backend: Unimock,
    pub(super) user: UserId,
    pub(super) store: Arc<dyn Store>,
    pub(super) cookie: String,
    pub(super) csrf: String,
    client: Client,
    pub(super) origin: String,
    pub(super) _schema: ScratchSchema,
    _database_scenario: MutexGuard<'static, ()>,
}

impl Harness {
    pub(super) fn start() -> Option<Self> {
        Self::start_with_runtime(Arc::new(mkc_auth::runtime::SystemRuntime))
    }

    pub(super) fn start_with_runtime(runtime: Arc<dyn mkc_auth::runtime::Runtime>) -> Option<Self> {
        Self::configured(runtime, false, RunMode::Fail, false)
    }

    pub(super) fn start_with_desktop_client(desktop_client: bool) -> Option<Self> {
        Self::configured(
            Arc::new(mkc_auth::runtime::SystemRuntime),
            false,
            RunMode::Fail,
            desktop_client,
        )
    }

    pub(super) fn start_with_builds() -> Option<Self> {
        Self::configured(
            Arc::new(mkc_auth::runtime::SystemRuntime),
            true,
            RunMode::Fail,
            false,
        )
    }

    pub(super) fn start_with_build_mode(mode: RunMode) -> Option<Self> {
        Self::configured(
            Arc::new(mkc_auth::runtime::SystemRuntime),
            true,
            mode,
            false,
        )
    }

    fn configured(
        runtime: Arc<dyn mkc_auth::runtime::Runtime>,
        configured: bool,
        mode: RunMode,
        desktop_client: bool,
    ) -> Option<Self> {
        let database_scenario = DATABASE_SCENARIO
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let schema = ScratchSchema::create("github")?;
        let listener = BoundListener::bind();
        let origin = listener.origin.clone();
        let github = RecordedGitHub::start("127.0.0.1:0".parse().unwrap()).unwrap();
        github.mode.lock().unwrap().exact_branch_reads = configured;
        let build_requests = Arc::new(Mutex::new(Vec::new()));
        let build_backend = if configured {
            Unimock::new(
                SandboxLifecycleMock::list_managed_sandboxes
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(Vec::new())),
            )
        } else {
            Unimock::new(())
        };
        let builds: Arc<dyn BuildProviderFactory> = if configured {
            Arc::new(RecordedBuildProviders {
                mode,
                runs: build_requests.clone(),
                backend: build_backend.clone(),
                publish_signals: None,
            })
        } else {
            Arc::new(SystemBuildProviderFactory)
        };
        let factory = ConfiguredApplicationFactory {
            builds,
            github: Arc::new(SystemGitHubProviderFactory),
            billing: Arc::new(SystemBillingProviderFactory),
            runtime,
        };
        let mut settings = settings(&schema, listener.address, configured, &github.origin);
        settings.desktop_client = desktop_client;
        let app = factory.create(settings).unwrap();
        let store = PgStoreFactory {
            runtime: Arc::new(SystemRuntime),
        }
        .connect(schema.scoped_url())
        .unwrap();
        let user = UserId(Uuid::now_v7());
        store
            .transaction(&mut Callback(&mut |queries| {
                queries.insert_user(&User {
                    id: user,
                    email: "octocat@example.com".into(),
                    name: "Existing email account".into(),
                    created_at: Utc::now(),
                })
            }))
            .unwrap();
        let harness = Self {
            _server: ServerThread::start_api(app, listener),
            _database_scenario: database_scenario,
            github,
            build_requests,
            _build_backend: build_backend,
            user,
            store,
            cookie: String::new(),
            csrf: String::new(),
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap(),
            origin,
            _schema: schema,
        };
        harness
            ._server
            .wait_until_ready(&mut || harness.request(Method::GET, "/v1/session").send().is_ok());
        Some(harness)
    }

    pub(super) fn request(&self, method: Method, path: &str) -> ContractRequest {
        self.request_from(method, path, APP)
    }

    pub(super) fn request_from(&self, method: Method, path: &str, origin: &str) -> ContractRequest {
        ContractRequest::new(&self.client, method, format!("{}{path}", self.origin))
            .header("Origin", origin)
            .header("Cookie", &self.cookie)
            .header("X-CSRF-Token", &self.csrf)
    }

    pub(super) fn queries(&self, operation: &mut dyn FnMut(&mut dyn Queries)) {
        self.store
            .transaction(&mut Callback(&mut |queries| {
                operation(queries);
                Ok(())
            }))
            .unwrap();
    }

    pub(super) fn replica_store(&self) -> Arc<dyn Store> {
        PgStoreFactory {
            runtime: Arc::new(SystemRuntime),
        }
        .connect(self._schema.scoped_url())
        .unwrap()
    }

    pub(super) fn session(&mut self, response: ContractResponse) -> Value {
        assert_eq!(response.status(), 200, "{}", response.text().unwrap());
        self.cookie = response.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .split(';')
            .next()
            .unwrap()
            .to_owned();
        let body: Value = response.json().unwrap();
        self.csrf = body["session"]["csrfToken"].as_str().unwrap().into();
        body
    }
}

pub(super) fn json(response: ContractResponse, status: u16) -> Value {
    let actual = response.status().as_u16();
    let text = response.text().unwrap();
    assert_eq!(actual, status, "{text}");
    serde_json::from_str(&text).unwrap()
}
