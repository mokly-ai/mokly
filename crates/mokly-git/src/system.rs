//! Host Git adapter with concurrent bounded input and output.

use std::ffi::OsString;
use std::io::Write;

use std::sync::Arc;
use std::thread;
use std::time::Duration;

use mokly_platform::processes::{ProcessGroup, ProcessGroups};

use crate::cancellation::signal;
use crate::command::{self, DEFAULT_OUTPUT_LIMIT, Output, Request};
use crate::control::{Cancellation, Clock, Shutdown};
use crate::error::{Error, InternalError, IoResult, Result};
use crate::pipes::{capture, copy, copy_bounded, digest};
use crate::system_command::git_command;

pub(crate) enum OutputMode<'a> {
    Capture,
    Digest,
    Copy(&'a mut (dyn Write + Send), usize),
    BoundedCopy(&'a mut (dyn Write + Send), usize),
}

/// Git process adapter composed with tree ownership, cancellation and time.
pub struct SystemRunner {
    /// Platform group or job-object implementation.
    pub groups: Arc<dyn ProcessGroups>,
    /// Command-generation cancellation.
    pub cancellation: Arc<dyn Cancellation>,
    /// Monotonic supervision clock.
    pub clock: Arc<dyn Clock>,
}

impl SystemRunner {
    pub(crate) fn execute(
        &self,
        request: &Request,
        cancellation: Option<&dyn command::Cancellation>,
        mode: OutputMode<'_>,
        environment: &[(&str, OsString)],
        timeout: Option<Duration>,
    ) -> Result<Output> {
        if request.output_limit > DEFAULT_OUTPUT_LIMIT
            || request.stderr_limit > DEFAULT_OUTPUT_LIMIT
        {
            return Err(Error::InvalidOutputLimit {
                limit: request.output_limit.max(request.stderr_limit),
                maximum: DEFAULT_OUTPUT_LIMIT,
            });
        }
        if request.stdin.len() > DEFAULT_OUTPUT_LIMIT {
            return Err(Error::InputLimit {
                limit: DEFAULT_OUTPUT_LIMIT,
            });
        }
        if self.cancellation.cancelled()
            || cancellation.is_some_and(command::Cancellation::is_cancelled)
        {
            return Err(Error::Cancelled);
        }
        tracing::debug!(
            arguments = request.args.len(),
            "starting bounded Git command"
        );
        let mut command = git_command(request, environment);
        if let Err(source) = self.groups.configure(&mut command) {
            return Err(Error::Platform { source });
        }
        let mut child = command.spawn().git()?;
        let group: Arc<dyn ProcessGroup> = match self.groups.attach(&child) {
            Ok(group) => Arc::from(group),
            Err(source) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(Error::Platform { source });
            }
        };
        let (Some(stdout), Some(stderr), Some(mut stdin)) =
            (child.stdout.take(), child.stderr.take(), child.stdin.take())
        else {
            let _ = group.kill();
            let _ = child.wait();
            return Err(Error::Internal(InternalError::Worker));
        };
        thread::scope(|scope| {
            let output_group = Arc::clone(&group);
            let error_group = Arc::clone(&group);
            let output = scope.spawn(move || match mode {
                OutputMode::Digest => digest(stdout, output_group.as_ref()),
                OutputMode::Capture => capture(stdout, request.output_limit, output_group.as_ref()),
                OutputMode::Copy(output, bytes) => {
                    let mut stdout = stdout;
                    copy(&mut stdout, output, bytes, output_group.as_ref())
                }
                OutputMode::BoundedCopy(output, bytes) => {
                    let mut stdout = stdout;
                    copy_bounded(&mut stdout, output, bytes, output_group.as_ref())
                }
            });
            let errors =
                scope.spawn(move || capture(stderr, request.stderr_limit, error_group.as_ref()));
            let input_group = Arc::clone(&group);
            let input = scope.spawn(move || {
                let result = stdin.write_all(&request.stdin);
                if result.is_err() {
                    let _ = input_group.kill();
                }
                result
            });
            let mut shutdown = Shutdown::default();
            let mut cancelled = false;
            let started = self.clock.now();
            let mut timed_out = false;
            let mut status = None;
            let mut failure = None;
            while status.is_none()
                || !output.is_finished()
                || !errors.is_finished()
                || !input.is_finished()
            {
                cancelled |= self.cancellation.cancelled()
                    || cancellation.is_some_and(command::Cancellation::is_cancelled);
                if !cancelled
                    && timeout
                        .is_some_and(|limit| self.clock.now().saturating_sub(started) >= limit)
                {
                    timed_out = true;
                    cancelled = true;
                }
                if let Err(error) =
                    signal(&mut shutdown, group.as_ref(), self.clock.now(), cancelled)
                {
                    failure = Some(error);
                    let _ = group.kill();
                    status = child.wait().ok();
                    break;
                }
                if status.is_none() {
                    match child.try_wait() {
                        Ok(value) => status = value,
                        Err(source) => {
                            failure = Some(Error::Internal(InternalError::Io { source }));
                            let _ = group.kill();
                            status = child.wait().ok();
                            break;
                        }
                    }
                }
                if status.is_none()
                    || !output.is_finished()
                    || !errors.is_finished()
                    || !input.is_finished()
                {
                    self.clock.pause(Duration::from_millis(5));
                }
            }
            let stdout = output.join();
            let stderr = errors.join();
            let written = input.join();
            if let Some(error) = failure {
                return Err(error);
            }
            let _ = group.kill();
            if cancelled {
                if timed_out {
                    return Err(Error::CheckoutTimeout);
                }
                return Err(Error::Cancelled);
            }
            let stdout = joined(stdout);
            let stderr = joined(stderr)?;
            let Some(status) = status else {
                return Err(Error::Internal(InternalError::Worker));
            };
            if !status.success() && matches!(stdout, Err(Error::MalformedOutput)) {
                return Err(Error::CommandFailed {
                    status: status.code(),
                    stderr,
                });
            }
            let stdout = stdout?;
            if !status.success() {
                return Err(Error::CommandFailed {
                    status: status.code(),
                    stderr,
                });
            }
            match written {
                Ok(result) => result.git()?,
                Err(_) => return Err(Error::Internal(InternalError::Worker)),
            }
            Ok(Output { stdout, stderr })
        })
    }
}

fn joined(result: thread::Result<Result<Vec<u8>>>) -> Result<Vec<u8>> {
    match result {
        Ok(value) => value,
        Err(_) => Err(Error::Internal(InternalError::Worker)),
    }
}

#[cfg(test)]
#[path = "_tests_/system_tests.rs"]
mod system_tests;
