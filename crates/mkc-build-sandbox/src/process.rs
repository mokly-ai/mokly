//! Deadline-bounded process dispatch with a separate sink delivery task.

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use mkc_build_interface::log::{BuildLogChunk, BuildLogSink, BuildStream};
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_build_interface::request::BuildRequest;
use sandbox_interface::{BackendStreamProcessRequest, ProviderRef, SandboxProcesses};
use tokio::sync::mpsc::{UnboundedReceiver, unbounded_channel};
use tokio::task::JoinHandle;
use tokio::time::{Instant, timeout_at};

use crate::clock::BuildClock;
use crate::command::{Command, OUTPUT_LIMIT};
use crate::failure::Failure;
use crate::output::{OutputReader, ProcessResult, StreamReader};

#[async_trait]
pub(crate) trait ProcessDriver: Send + Sync {
    async fn run(&self, step: BuildStep, command: Command) -> Result<ProcessResult, BuildOutcome>;
}

pub(crate) struct ProcessExecutor<'a> {
    pub(crate) request: &'a BuildRequest,
    pub(crate) processes: Arc<dyn SandboxProcesses>,
    pub(crate) clock: Arc<dyn BuildClock>,
    pub(crate) sink: Arc<dyn BuildLogSink>,
    pub(crate) provider: ProviderRef,
}

/// Aborts the detached sink writer when the owning process future is dropped.
struct SinkTask(JoinHandle<Result<(), Failure>>);

impl Drop for SinkTask {
    fn drop(&mut self) {
        self.0.abort();
    }
}

#[async_trait]
trait ChunkWriter: Send + Sync {
    async fn write(&self, receiver: UnboundedReceiver<BuildLogChunk>) -> Result<(), Failure>;
}

struct SinkWriter(Arc<dyn BuildLogSink>);

#[async_trait]
impl ChunkWriter for SinkWriter {
    async fn write(&self, mut receiver: UnboundedReceiver<BuildLogChunk>) -> Result<(), Failure> {
        while let Some(chunk) = receiver.recv().await {
            if self.0.write(chunk).await.is_err() {
                return Err(Failure::Sink);
            }
        }
        Ok(())
    }
}

#[async_trait]
impl ProcessDriver for ProcessExecutor<'_> {
    async fn run(&self, step: BuildStep, command: Command) -> Result<ProcessResult, BuildOutcome> {
        if command.contains_credential(self.request) {
            return Err(Failure::CredentialInArgument.outcome());
        }
        let deadline = remaining(self.request.deadline_at, self.clock.now());
        if deadline.is_zero() {
            return Err(BuildOutcome::TimedOut {
                step,
                budget: BuildBudget::Deadline,
            });
        }
        let idle = match step {
            BuildStep::Checkout => Duration::from_secs(120),
            BuildStep::Install => Duration::from_secs(300),
            BuildStep::Publish => deadline,
        }
        .min(deadline);
        let cutoff = Instant::now() + deadline;
        let (result, mut writer) = {
            let (sender, receiver) = unbounded_channel();
            let sink = self.sink.clone();
            let mut writer = SinkTask(tokio::spawn(async move {
                let writer: &dyn ChunkWriter = &SinkWriter(sink);
                writer.write(receiver).await
            }));
            if sender
                .send(BuildLogChunk {
                    attempt_operation_id: self.request.attempt_operation_id,
                    step,
                    stream: BuildStream::System,
                    bytes: command.display().into_bytes(),
                })
                .is_err()
            {
                return Err(Failure::Sink.outcome());
            }
            let dispatch = async {
                let request = BackendStreamProcessRequest {
                    sandbox_provider_ref: self.provider.clone(),
                    command: command.program.clone(),
                    args: command.args.clone(),
                    cwd: Some(command.cwd.clone()),
                    envs: command.environment(self.request),
                    stdout_limit: OUTPUT_LIMIT,
                    stderr_limit: OUTPUT_LIMIT,
                    deadline,
                    idle_timeout: idle,
                };
                let stream = match timeout_at(cutoff, self.processes.stream_process(request)).await
                {
                    Ok(Ok(stream)) => stream,
                    Ok(Err(_)) => return Err(Failure::Transport.outcome()),
                    Err(_) => {
                        return Err(BuildOutcome::TimedOut {
                            step,
                            budget: BuildBudget::Deadline,
                        });
                    }
                };
                let reader: &dyn OutputReader = &StreamReader {
                    request: self.request,
                    step,
                };
                reader
                    .read(stream, &sender, cutoff, command.capture_stdout, idle)
                    .await
            };
            let result = tokio::select! {
                result = dispatch => result,
                _ = &mut writer.0 => { return Err(Failure::Sink.outcome()); }
            };
            (result, writer)
        };
        match timeout_at(
            cutoff.max(Instant::now()) + Duration::from_secs(1),
            &mut writer.0,
        )
        .await
        {
            Ok(Ok(Ok(()))) => result,
            Ok(_) => Err(Failure::Sink.outcome()),
            Err(_) => Err(Failure::SinkBackpressure.outcome()),
        }
    }
}

pub(crate) fn remaining(deadline: DateTime<Utc>, now: DateTime<Utc>) -> Duration {
    deadline
        .signed_duration_since(now)
        .to_std()
        .unwrap_or_default()
        .min(Duration::from_secs(3600))
}
