//! Ordered build execution and explicit progress before each step.

use std::sync::Arc;

use async_trait::async_trait;
use mkc_build_interface::log::BuildLogSink;
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_build_interface::request::BuildRequest;
use tokio::time::timeout;

use crate::checkout::Checkout;
use crate::clock::BuildClock;
use crate::failure::Failure;
use crate::install::Install;
use crate::output::ProcessResult;
use crate::process::remaining;
use crate::publish::Publish;

#[async_trait]
pub(crate) trait BuildSession: Send + Sync {
    async fn execute(&self) -> Result<(), BuildOutcome>;
}

pub(crate) struct Session<'a> {
    pub(crate) request: &'a BuildRequest,
    pub(crate) sink: Arc<dyn BuildLogSink>,
    pub(crate) clock: Arc<dyn BuildClock>,
    pub(crate) checkout: &'a dyn Checkout,
    pub(crate) install: &'a dyn Install,
    pub(crate) publish: &'a dyn Publish,
}

#[async_trait]
impl BuildSession for Session<'_> {
    async fn execute(&self) -> Result<(), BuildOutcome> {
        self.start(BuildStep::Checkout).await?;
        self.checkout.checkout().await?;
        self.start(BuildStep::Install).await?;
        let installed = self.install.install().await?;
        self.start(BuildStep::Publish).await?;
        self.publish.publish(installed.as_deref()).await
    }
}

impl Session<'_> {
    async fn start(&self, step: BuildStep) -> Result<(), BuildOutcome> {
        let budget = remaining(self.request.deadline_at, self.clock.now());
        if budget.is_zero() {
            return Err(BuildOutcome::TimedOut {
                step,
                budget: BuildBudget::Deadline,
            });
        }
        match timeout(
            budget,
            self.sink
                .step_started(self.request.attempt_operation_id, step),
        )
        .await
        {
            Ok(Ok(())) => Ok(()),
            _ => Err(Failure::Sink.outcome()),
        }
    }
}

pub(crate) fn require(
    result: ProcessResult,
    step: BuildStep,
) -> Result<ProcessResult, BuildOutcome> {
    if result.exit_code == Some(0) {
        Ok(result)
    } else {
        Err(failed(result, step))
    }
}

pub(crate) fn probe(result: ProcessResult, step: BuildStep) -> Result<bool, BuildOutcome> {
    if let Some(code) = result.exit_code {
        Ok(code == 0)
    } else {
        Err(failed(result, step))
    }
}

fn failed(result: ProcessResult, step: BuildStep) -> BuildOutcome {
    BuildOutcome::StepFailed {
        step,
        exit_code: result.exit_code,
        cli_error: if step == BuildStep::Publish {
            result.cli_error
        } else {
            None
        },
    }
}
