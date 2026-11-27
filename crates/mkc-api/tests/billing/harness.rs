//! Isolated Postgres schema, real API, deterministic clock and recorded Stripe transport.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use chrono::Utc;
use mkc_api::application::{ApplicationFactory, ConfiguredApplicationFactory};
use mkc_api::github_providers::SystemGitHubProviderFactory;
use mkc_api::worker_intervals::WorkerIntervals;
use mkc_auth::runtime::Runtime as AuthRuntime;
use mkc_billing::prices::VerifiedPriceIds;
use mkc_billing::seats::worker::{DatabaseSeatReconciler, SeatReconciler};
use mkc_billing_interface::credentials::Secret;
use mkc_billing_interface::provider::BillingProvider;
use mkc_billing_stripe::client::StripeClient;
use mkc_billing_stripe::transport::{HttpFactory, OPERATION_TIMEOUT, ReqwestFactory};
use mkc_store_interface::store::{Callback, Queries, Store};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime as StoreRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use reqwest::Method;
use reqwest::blocking::Client;
use serde_json::Value;

use crate::contract_client::{ContractRequest, ContractResponse};
use crate::test_server::{BoundListener, ServerThread};

use super::harness_data::{Principal, principal, seed_principal, settings};
use super::stripe_double::{
    COLLABORATOR_PRICE, EDITOR_PRICE, PriceScenario, RecordedStripe, SECRET_KEY,
};
use super::stripe_factory::RecordedBillingFactory;
use super::test_runtime::TestRuntime;

pub(super) const APP: &str = "https://app.example.com";
static DATABASE_SCENARIO: Mutex<()> = Mutex::new(());

/// The billing delivery pause of the test API: a webhook delivery starts within
/// a few milliseconds of its write, not after the production second.
const QUICK_WORKER_PAUSE: Duration = Duration::from_millis(20);

pub(super) struct Harness {
    /// Stop workers before the Stripe double, store, schema and database lock drop.
    _server: ServerThread,
    pub(super) stripe: RecordedStripe,
    pub(super) runtime: Arc<TestRuntime>,
    pub(super) store: Arc<dyn Store>,
    pub(super) owner: Principal,
    pub(super) reviewer: Principal,
    client: Client,
    origin: String,
    _schema: ScratchSchema,
    server_errors: AtomicUsize,
    _database_scenario: MutexGuard<'static, ()>,
}

impl Harness {
    pub(super) fn start() -> Option<Self> {
        Self::start_with_price_scenario(PriceScenario::Complete)
    }

    pub(super) fn start_with_price_scenario(price_scenario: PriceScenario) -> Option<Self> {
        let database_scenario = DATABASE_SCENARIO
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let schema = ScratchSchema::create("billing")?;
        let listener = BoundListener::bind();
        let origin = listener.origin.clone();
        let stripe = RecordedStripe::start_with_price_scenario(price_scenario);
        let runtime = Arc::new(TestRuntime::new(Utc::now()));
        let factory = ConfiguredApplicationFactory {
            builds: Arc::new(mkc_api::build_providers::SystemBuildProviderFactory),
            github: Arc::new(SystemGitHubProviderFactory),
            billing: Arc::new(RecordedBillingFactory {
                origin: stripe.origin.clone(),
            }),
            runtime: runtime.clone(),
            intervals: WorkerIntervals {
                billing_delivery: QUICK_WORKER_PAUSE,
                ..WorkerIntervals::default()
            },
        };
        let app = factory
            .create(settings(
                schema.scoped_url().to_owned(),
                listener.address,
                &stripe.origin,
            ))
            .unwrap();
        let store = PgStoreFactory {
            runtime: Arc::new(StoreRuntime),
        }
        .connect(schema.scoped_url())
        .unwrap();
        let owner = principal("owner@example.com");
        let reviewer = principal("reviewer@example.com");
        let now = runtime.now();
        store
            .transaction(&mut Callback(&mut |queries| {
                seed_principal(queries, &owner, "Owner", now)?;
                seed_principal(queries, &reviewer, "Reviewer", now)
            }))
            .unwrap();
        let harness = Self {
            _server: ServerThread::start_api(app, listener),
            stripe,
            runtime,
            store,
            owner,
            reviewer,
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap(),
            origin,
            _schema: schema,
            server_errors: AtomicUsize::new(0),
            _database_scenario: database_scenario,
        };
        harness
            ._server
            .wait_until_ready(&mut || harness.anonymous(Method::GET, "/v1/session").send().is_ok());
        Some(harness)
    }

    pub(super) fn request(&self, method: Method, path: &str) -> ContractRequest {
        self.request_as(method, path, &self.owner)
    }

    pub(super) fn request_as(
        &self,
        method: Method,
        path: &str,
        principal: &Principal,
    ) -> ContractRequest {
        ContractRequest::new(&self.client, method, format!("{}{path}", self.origin))
            .header("Origin", APP)
            .header("Cookie", format!("mkc_session={}", principal.credential))
            .header("X-CSRF-Token", &principal.csrf)
    }

    pub(super) fn anonymous(&self, method: Method, path: &str) -> ContractRequest {
        ContractRequest::new(&self.client, method, format!("{}{path}", self.origin))
    }

    pub(super) fn json(&self, response: ContractResponse, status: u16) -> Value {
        let bytes = self.body(response, status);
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        }
    }

    pub(super) fn body(&self, response: ContractResponse, status: u16) -> Vec<u8> {
        let actual = response.status().as_u16();
        if actual >= 500 {
            self.server_errors.fetch_add(1, Ordering::SeqCst);
        }
        let bytes = response.bytes();
        assert_eq!(actual, status, "{}", String::from_utf8_lossy(&bytes));
        bytes
    }

    pub(super) fn queries(&self, operation: &mut dyn FnMut(&mut dyn Queries)) {
        self.store
            .transaction(&mut Callback(&mut |queries| {
                operation(queries);
                Ok(())
            }))
            .unwrap();
    }

    pub(super) fn run_seats(&self) -> bool {
        self.seat_reconciler().run_once().unwrap()
    }

    pub(super) fn seat_reconciler(&self) -> DatabaseSeatReconciler {
        let provider: Arc<dyn BillingProvider> = Arc::new(StripeClient {
            http: ReqwestFactory
                .build(&self.stripe.origin, OPERATION_TIMEOUT)
                .unwrap(),
            key: Secret::new(SECRET_KEY.into()),
        });
        DatabaseSeatReconciler::new(
            self.store.clone(),
            self.runtime.clone(),
            provider,
            VerifiedPriceIds {
                editor: EDITOR_PRICE.into(),
                collaborator: COLLABORATOR_PRICE.into(),
            },
        )
    }

    pub(super) fn assert_no_server_errors(&self) {
        assert_eq!(self.server_errors.load(Ordering::SeqCst), 0);
    }
}
