//! Worker contracts and composition over injectable runtime boundaries.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use mkc_auth::runtime::Runtime;
use mkc_build_interface::runner::BuildRunner;
use mkc_build_interface::secret::Secret;
use mkc_github_interface::credentials::Tokens;
use mkc_store_interface::build::Build;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use crate::error::Result;
use crate::transaction::Transactions;

/// Async waiting seam; the UTC clock and entropy come from Runtime.
#[unimock::unimock(api = BuildLeaseClockMock)]
pub trait BuildLeaseClock: Send + Sync {
    /// Wait before renewing an active attempt.
    fn sleep(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
}

/// Runtime timer used only by the composition root.
pub struct TokioBuildLeaseClock;

impl BuildLeaseClock for TokioBuildLeaseClock {
    fn sleep(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(tokio::time::sleep(duration))
    }
}

/// One claim's result; a recovery or refusal needs no runner.
pub enum BuildClaim {
    /// No due build or no process slot.
    Idle,
    /// A claimed row was recovered or refused in the same transaction.
    Handled,
    /// A started attempt owns a process slot until execution ends.
    Attempt(Box<ClaimedBuild>),
}

/// Secret-bearing execution handle; deliberately has no Debug or serialization.
pub struct ClaimedBuild {
    pub(super) build: Build,
    pub(super) upload_token: Secret,
    pub(super) installation: i64,
    pub(super) repository: i64,
    pub(super) repository_name: String,
    pub(super) _permit: OwnedSemaphorePermit,
}

/// Durable worker; synchronous claims run off the async reactor.
#[unimock::unimock(api = BuildWorkerMock)]
#[async_trait]
pub trait BuildWorker: Send + Sync {
    /// Claim, recover, reject or start one row atomically, within both limits.
    fn claim(&self) -> Result<BuildClaim>;
    /// Run one owned attempt, renew its lease and record its fenced outcome.
    async fn execute(&self, attempt: ClaimedBuild) -> Result<()>;
}

/// Nonsecret worker limits and upload origin.
#[derive(Clone)]
pub struct BuildWorkerConfig {
    /// Existing API origin used for the project's full upload endpoint.
    pub api_origin: String,
    /// Concurrent attempts in this process, validated to 1 through 16.
    pub per_process: usize,
}

/// Composition seam returning the runtime worker as a trait object.
pub trait BuildWorkerFactory {
    /// Construct one process's worker and concurrency limiter.
    fn create(&self, config: BuildWorkerConfig) -> Arc<dyn BuildWorker>;
}

/// Worker composition owns no provider-specific implementation.
pub struct DatabaseBuildWorkerFactory {
    /// Query-only transactions.
    pub transactions: Arc<dyn Transactions>,
    /// Secure entropy before retries; fresh lease time after ownership locks.
    pub runtime: Arc<dyn Runtime>,
    /// Uncached repository Contents-read credentials.
    pub credentials: Arc<dyn Tokens>,
    /// Isolated attempt runner.
    pub runner: Arc<dyn BuildRunner>,
    /// Lease interval timer.
    pub clock: Arc<dyn BuildLeaseClock>,
}

pub(super) struct DatabaseBuildWorker {
    pub(super) transactions: Arc<dyn Transactions>,
    pub(super) runtime: Arc<dyn Runtime>,
    pub(super) credentials: Arc<dyn Tokens>,
    pub(super) runner: Arc<dyn BuildRunner>,
    pub(super) clock: Arc<dyn BuildLeaseClock>,
    pub(super) slots: Arc<Semaphore>,
    pub(super) config: BuildWorkerConfig,
}

impl BuildWorkerFactory for DatabaseBuildWorkerFactory {
    fn create(&self, config: BuildWorkerConfig) -> Arc<dyn BuildWorker> {
        Arc::new(DatabaseBuildWorker {
            transactions: self.transactions.clone(),
            runtime: self.runtime.clone(),
            credentials: self.credentials.clone(),
            runner: self.runner.clone(),
            clock: self.clock.clone(),
            slots: Arc::new(Semaphore::new(config.per_process)),
            config,
        })
    }
}

#[async_trait]
impl BuildWorker for DatabaseBuildWorker {
    fn claim(&self) -> Result<BuildClaim> {
        self.claim_attempt()
    }

    async fn execute(&self, attempt: ClaimedBuild) -> Result<()> {
        self.run_attempt(attempt).await
    }
}
