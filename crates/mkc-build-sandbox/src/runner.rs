//! One-shot runner composition, credential delivery and cleanup on all paths.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use mkc_build_interface::error::{Error, Result};
use mkc_build_interface::log::BuildLogSink;
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_build_interface::request::BuildRequest;
use mkc_build_interface::runner::BuildRunner;
use sandbox_interface::{
    BackendCreateSandboxRequest, BackendSandbox, BackendWriteFileRequest, Error as SandboxError,
    OperationId, ResourceOwner, SandboxConsumer, SandboxFiles, SandboxId, SandboxLifecycle,
    SandboxLifetime, SandboxNetworkPolicy, SandboxProcesses,
};
use tokio::runtime::Handle;
use tokio::time::timeout;

use crate::checkout::CheckoutRunner;
use crate::cleanup::Cleanup;
use crate::clock::BuildClock;
use crate::failure::Failure;
use crate::install::DependencyInstaller;
use crate::process::{ProcessDriver, ProcessExecutor, remaining};
use crate::publish::Publisher;
use crate::session::{BuildSession, Session};

/// The sandbox capabilities that a build attempt uses, usually one shared backend.
#[derive(Clone)]
pub struct BuildSandboxCapabilities {
    /// Create, ambiguous-create recovery and destruction.
    pub lifecycle: Arc<dyn SandboxLifecycle>,
    /// Delivery of the checkout credential file.
    pub files: Arc<dyn SandboxFiles>,
    /// Streaming build commands.
    pub processes: Arc<dyn SandboxProcesses>,
}

/// Runs builds against the caller's preconfigured build profile and backend.
pub struct SandboxBuildRunner {
    sandbox: BuildSandboxCapabilities,
    clock: Arc<dyn BuildClock>,
    deployment_id: String,
}

impl SandboxBuildRunner {
    /// Compose the runner; the caller configures the backend's build profile.
    pub fn new(
        sandbox: BuildSandboxCapabilities,
        clock: Arc<dyn BuildClock>,
        deployment_id: String,
    ) -> Result<Self> {
        if !(1..=63).contains(&deployment_id.len())
            || !deployment_id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err(Error::internal(Failure::Deployment));
        }
        Ok(Self {
            sandbox,
            clock,
            deployment_id,
        })
    }
}

impl BuildRunner for SandboxBuildRunner {
    fn run(
        &self,
        request: BuildRequest,
        sink: Arc<dyn BuildLogSink>,
    ) -> Pin<Box<dyn Future<Output = BuildOutcome> + Send + '_>> {
        Box::pin(async move {
            let Ok(runtime) = Handle::try_current() else {
                return Failure::Runtime.outcome();
            };
            let budget = remaining(request.deadline_at, self.clock.now());
            if budget.is_zero() {
                return BuildOutcome::TimedOut {
                    step: BuildStep::Checkout,
                    budget: BuildBudget::Deadline,
                };
            }
            let seconds = budget.as_secs() + u64::from(budget.subsec_nanos() > 0);
            let create = BackendCreateSandboxRequest {
                sandbox_id: SandboxId::from_uuid(request.build_id),
                operation_id: OperationId::from_uuid(request.attempt_operation_id),
                owner: ResourceOwner::platform(request.project_id.0),
                consumer: SandboxConsumer::Runtime,
                lifetime: SandboxLifetime::OneShot {
                    max_lifetime: Duration::from_secs((seconds + 120).min(3600)),
                },
                deployment_id: self.deployment_id.clone(),
                profile: "build".into(),
                network: SandboxNetworkPolicy::Open,
                snapshot_provider_ref: None,
                size: None,
            };
            let mut cleanup = Cleanup::new(self.sandbox.lifecycle.clone(), runtime, create.clone());
            let sandbox: BackendSandbox = match timeout(
                budget,
                self.sandbox.lifecycle.create_sandbox(create.clone()),
            )
            .await
            {
                Ok(Ok(sandbox)) => sandbox,
                Ok(Err(SandboxError::BackendUnavailable { .. })) | Err(_) => {
                    match timeout(
                        remaining(request.deadline_at, self.clock.now()),
                        self.sandbox.lifecycle.recover_sandbox_create(create),
                    )
                    .await
                    {
                        Ok(Ok(Some(sandbox))) => sandbox,
                        _ => {
                            cleanup.resolved();
                            return Failure::Recovery.outcome();
                        }
                    }
                }
                Ok(Err(_)) => {
                    cleanup.resolved();
                    return Failure::Create.outcome();
                }
            };
            cleanup.acquired(sandbox.provider_ref.clone());
            let outcome = match timeout(
                remaining(request.deadline_at, self.clock.now()),
                self.sandbox.files.write_file(BackendWriteFileRequest {
                    sandbox_provider_ref: sandbox.provider_ref.clone(),
                    root: "/home/user".into(),
                    path: ".mokly-git-credentials".into(),
                    bytes: format!(
                        "https://x-access-token:{}@github.com\n",
                        request.installation_token.expose()
                    )
                    .into_bytes(),
                }),
            )
            .await
            {
                Ok(Ok(())) => {
                    let process: &dyn ProcessDriver = &ProcessExecutor {
                        request: &request,
                        processes: self.sandbox.processes.clone(),
                        clock: self.clock.clone(),
                        sink: sink.clone(),
                        provider: sandbox.provider_ref,
                    };
                    let session: &dyn BuildSession = &Session {
                        request: &request,
                        sink,
                        clock: self.clock.clone(),
                        checkout: &CheckoutRunner {
                            request: &request,
                            process,
                        },
                        install: &DependencyInstaller {
                            request: &request,
                            process,
                        },
                        publish: &Publisher {
                            request: &request,
                            process,
                        },
                    };
                    match session.execute().await {
                        Ok(()) => BuildOutcome::Completed,
                        Err(outcome) => outcome,
                    }
                }
                _ => Failure::Write.outcome(),
            };
            if let Err(failure) = cleanup.finish().await {
                tracing::warn!(
                    build_id = %request.build_id,
                    attempt_operation_id = %request.attempt_operation_id,
                    failure = ?failure,
                    "sandbox cleanup failed"
                );
            }
            outcome
        })
    }
}

#[cfg(test)]
#[path = "_tests_/runner/mod.rs"]
mod runner_tests;
