//! Async persistence sink for already-redacted chunks and lease-fenced progress.

use std::sync::Arc;

use async_trait::async_trait;
use mkc_auth::runtime::Runtime;
use mkc_build_interface::error;
use mkc_build_interface::log::{BuildLogChunk, BuildLogSink, BuildStream};
use mkc_build_interface::outcome::BuildStep;
use mkc_domain::ids::BuildId;
use mkc_store_interface::build_log::NewBuildLogChunk;
use mkc_store_interface::build_state;
use uuid::Uuid;

use crate::error::{Error, ErrorResultExt};
use crate::transaction::Transactions;

#[derive(Debug, thiserror::Error)]
enum AttemptFailure {
    #[error("[mkc-publications/build_worker] attempt lost its progress fence")]
    Lost,
}

pub(super) fn lost() -> Error {
    Error::internal(AttemptFailure::Lost)
}

pub(super) struct AttemptSink {
    pub(super) transactions: Arc<dyn Transactions>,
    pub(super) runtime: Arc<dyn Runtime>,
    pub(super) build: BuildId,
    pub(super) operation: Uuid,
    pub(super) lease: Uuid,
}

pub(super) fn store_step(step: BuildStep) -> build_state::BuildStep {
    match step {
        BuildStep::Checkout => build_state::BuildStep::Checkout,
        BuildStep::Install => build_state::BuildStep::Install,
        BuildStep::Publish => build_state::BuildStep::Publish,
    }
}

#[async_trait]
impl BuildLogSink for AttemptSink {
    async fn step_started(&self, operation: Uuid, step: BuildStep) -> error::Result<()> {
        if operation != self.operation {
            return Err(error::Error::internal(AttemptFailure::Lost));
        }
        let transactions = self.transactions.clone();
        let id = self.build;
        let lease = self.lease;
        let at = self.runtime.now();
        let result = error::ErrorResultExt::context(
            tokio::task::spawn_blocking(move || {
                transactions.run(false, &mut |queries| {
                    if !queries
                        .set_build_step(id, lease, store_step(step), at)
                        .context("record owned build progress")?
                    {
                        return Err(lost());
                    }
                    Ok(())
                })
            })
            .await,
            "join build progress",
        )?;
        error::ErrorResultExt::context(result, "persist build progress")
    }

    async fn write(&self, chunk: BuildLogChunk) -> error::Result<()> {
        if chunk.attempt_operation_id != self.operation {
            return Ok(());
        }
        let transactions = self.transactions.clone();
        let id = self.build;
        let chunk = NewBuildLogChunk {
            attempt_operation_id: chunk.attempt_operation_id,
            step: Some(store_step(chunk.step)),
            stream: match chunk.stream {
                BuildStream::Stdout => build_state::BuildStream::Stdout,
                BuildStream::Stderr => build_state::BuildStream::Stderr,
                BuildStream::System => build_state::BuildStream::System,
            },
            bytes: chunk.bytes,
            created_at: self.runtime.now(),
        };
        let result = error::ErrorResultExt::context(
            tokio::task::spawn_blocking(move || {
                transactions.run(false, &mut |queries| {
                    queries
                        .append_build_log(id, &chunk)
                        .context("append redacted build log")?;
                    Ok(())
                })
            })
            .await,
            "join build log append",
        )?;
        error::ErrorResultExt::context(result, "persist build log")
    }
}
