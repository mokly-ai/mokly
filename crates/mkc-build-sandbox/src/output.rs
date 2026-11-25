//! Prompt provider-stream draining with independent redacted chunk staging.

use std::time::Duration;

use async_trait::async_trait;
use futures_util::StreamExt;
use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::log::{BuildLogChunk, BuildStream};
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_build_interface::request::BuildRequest;
use sandbox_interface::{ProcessEventStream, ProcessStreamEvent, ProcessStreamOutcome};
use tokio::sync::mpsc::UnboundedSender;
use tokio::time::{Instant, MissedTickBehavior, interval_at, sleep_until};

use crate::buffer::{CliError, OutputBuffer};
use crate::failure::Failure;

/// Facts required by probes and step failure handling, with redacted stdout.
pub(crate) struct ProcessResult {
    pub(crate) exit_code: Option<i32>,
    pub(crate) stdout: Vec<u8>,
    pub(crate) cli_error: Option<MoklyCliCode>,
}

#[async_trait]
pub(crate) trait OutputReader: Send + Sync {
    async fn read(
        &self,
        stream: ProcessEventStream,
        sender: &UnboundedSender<BuildLogChunk>,
        cutoff: Instant,
        capture: bool,
        idle: Duration,
    ) -> Result<ProcessResult, BuildOutcome>;
}

pub(crate) struct StreamReader<'a> {
    pub(crate) request: &'a BuildRequest,
    pub(crate) step: BuildStep,
    /// Byte cap of each stream; a stream past it ends the step.
    pub(crate) output_limit: usize,
}

#[async_trait]
impl OutputReader for StreamReader<'_> {
    async fn read(
        &self,
        mut stream: ProcessEventStream,
        sender: &UnboundedSender<BuildLogChunk>,
        cutoff: Instant,
        capture: bool,
        idle: Duration,
    ) -> Result<ProcessResult, BuildOutcome> {
        let tokens = [
            self.request.upload_token.expose(),
            self.request.installation_token.expose(),
        ];
        let mut buffers = [OutputBuffer::new(tokens), OutputBuffer::new(tokens)];
        let mut counts = [0usize; 2];
        let mut result = ProcessResult {
            exit_code: None,
            stdout: Vec::new(),
            cli_error: None,
        };
        let mut cli = CliError::default();
        let mut terminal = None;
        let mut timer = interval_at(
            Instant::now() + Duration::from_secs(1),
            Duration::from_secs(1),
        );
        timer.set_missed_tick_behavior(MissedTickBehavior::Skip);
        loop {
            let event = tokio::select! {
                event = stream.next() => event,
                _ = timer.tick() => {
                    for (index, buffer) in buffers.iter_mut().enumerate() {
                        self.stage(sender, channel(index), buffer.cut(true, false))?;
                    }
                    continue;
                },
                _ = sleep_until(cutoff) => { terminal = Some(ProcessStreamOutcome::DeadlineExpired); break; },
            };
            let Some(event) = event else { break };
            if terminal.is_some() {
                terminal = Some(ProcessStreamOutcome::TransportFailure);
                break;
            }
            let (index, bytes) = match event {
                ProcessStreamEvent::Stdout(bytes) => (0, bytes),
                ProcessStreamEvent::Stderr(bytes) => (1, bytes),
                ProcessStreamEvent::Exited { exit_code, exited } => {
                    result.exit_code = exited.then_some(exit_code);
                    continue;
                }
                ProcessStreamEvent::Outcome(outcome) => {
                    terminal = Some(outcome);
                    continue;
                }
                ProcessStreamEvent::Started { .. } => {
                    continue;
                }
            };
            let remaining = self.output_limit.saturating_sub(counts[index]);
            let redacted = buffers[index].push(&bytes[..bytes.len().min(remaining)], false);
            if index == 0 && capture {
                result.stdout.extend_from_slice(&redacted);
            }
            if index == 1 {
                cli.push(&redacted);
            }
            counts[index] = counts[index].saturating_add(bytes.len());
            self.stage(sender, channel(index), buffers[index].cut(false, false))?;
            if counts[index] > self.output_limit {
                terminal = Some(if index == 0 {
                    ProcessStreamOutcome::StdoutOverflow
                } else {
                    ProcessStreamOutcome::StderrOverflow
                });
                break;
            }
        }
        for (index, buffer) in buffers.iter_mut().enumerate() {
            let rest = buffer.push(&[], true);
            if index == 0 && capture {
                result.stdout.extend_from_slice(&rest);
            }
            if index == 1 {
                cli.push(&rest);
            }
            self.stage(sender, channel(index), buffer.cut(false, true))?;
        }
        cli.finish_line();
        result.cli_error = cli.last;
        let line = match terminal {
            Some(ProcessStreamOutcome::Completed) => match result.exit_code {
                Some(code) => format!("exit {code}\n"),
                None => "exit unknown\n".into(),
            },
            Some(ProcessStreamOutcome::IdleTimeout) => {
                format!("no output for {} minutes\n", idle.as_secs() / 60)
            }
            Some(ProcessStreamOutcome::DeadlineExpired) => "stopped at the time limit\n".into(),
            _ => String::new(),
        };
        if !line.is_empty() {
            let mut buffer = OutputBuffer::new(tokens);
            buffer.push(line.as_bytes(), true);
            self.stage(sender, BuildStream::System, buffer.cut(false, true))?;
        }
        match terminal {
            Some(ProcessStreamOutcome::Completed) => Ok(result),
            Some(ProcessStreamOutcome::IdleTimeout) => Err(BuildOutcome::TimedOut {
                step: self.step,
                budget: BuildBudget::Idle,
            }),
            Some(ProcessStreamOutcome::DeadlineExpired) => Err(BuildOutcome::TimedOut {
                step: self.step,
                budget: BuildBudget::Deadline,
            }),
            Some(ProcessStreamOutcome::StdoutOverflow | ProcessStreamOutcome::StderrOverflow) => {
                Err(BuildOutcome::OutputOverflow { step: self.step })
            }
            Some(ProcessStreamOutcome::ConsumerBackpressure) => {
                Err(Failure::Backpressure.outcome())
            }
            Some(ProcessStreamOutcome::TransportFailure) | None => {
                Err(Failure::Transport.outcome())
            }
        }
    }
}

impl StreamReader<'_> {
    fn stage(
        &self,
        sender: &UnboundedSender<BuildLogChunk>,
        stream: BuildStream,
        chunks: Vec<Vec<u8>>,
    ) -> Result<(), BuildOutcome> {
        for bytes in chunks {
            if sender
                .send(BuildLogChunk {
                    attempt_operation_id: self.request.attempt_operation_id,
                    step: self.step,
                    stream,
                    bytes,
                })
                .is_err()
            {
                return Err(Failure::Sink.outcome());
            }
        }
        Ok(())
    }
}

fn channel(index: usize) -> BuildStream {
    if index == 0 {
        BuildStream::Stdout
    } else {
        BuildStream::Stderr
    }
}
