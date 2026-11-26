//! Host Git adapter with concurrent bounded input and output.

use std::ffi::OsString;
use std::io::Write;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::{self, Thread};
use std::time::Duration;

use mokly_platform::processes::{ProcessGroup, ProcessGroups, ProcessTree, Unattached};

use crate::cancellation::signal;
use crate::command::{self, DEFAULT_OUTPUT_LIMIT, Output, ProcessMode, Request};
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
        let configured = match request.process_mode {
            ProcessMode::FullTree => self.groups.configure(&mut command),
            ProcessMode::PlainGroup => self.groups.configure_plain(&mut command),
        };
        if let Err(source) = configured {
            return Err(Error::Platform { source });
        }
        let mut child = command.spawn().git()?;
        let pipes = (child.stdout.take(), child.stderr.take(), child.stdin.take());
        // The tree reaps the root only when its last reference drops, after
        // the final signal, so no signal can reach a reused group number.
        let group = match self.groups.attach(child) {
            Ok(tree) => Arc::new(tree),
            Err(failure) => {
                // No guard exists, so `stop` stops the whole tree before it
                // gives back the child for the reap.
                let Unattached {
                    mut child, source, ..
                } = failure.stop(self.groups.as_ref());
                let _ = child.kill();
                let _ = child.wait();
                return Err(Error::Platform { source });
            }
        };
        let (Some(stdout), Some(stderr), Some(mut stdin)) = pipes else {
            let _ = group.kill();
            return Err(Error::Internal(InternalError::Worker));
        };
        let output_done = AtomicBool::new(false);
        let errors_done = AtomicBool::new(false);
        let input_done = AtomicBool::new(false);
        let child_done = AtomicBool::new(false);
        thread::scope(|scope| {
            let output_completion = Completion::new(&output_done, &group);
            let output = scope.spawn(move || {
                let completion = output_completion;
                match mode {
                    OutputMode::Digest => digest(stdout, completion.group.as_ref()),
                    OutputMode::Capture => {
                        capture(stdout, request.output_limit, completion.group.as_ref())
                    }
                    OutputMode::Copy(output, bytes) => {
                        let mut stdout = stdout;
                        copy(&mut stdout, output, bytes, completion.group.as_ref())
                    }
                    OutputMode::BoundedCopy(output, bytes) => {
                        let mut stdout = stdout;
                        copy_bounded(&mut stdout, output, bytes, completion.group.as_ref())
                    }
                }
            });
            let error_completion = Completion::new(&errors_done, &group);
            let errors = scope.spawn(move || {
                let completion = error_completion;
                capture(stderr, request.stderr_limit, completion.group.as_ref())
            });
            let input_completion = Completion::new(&input_done, &group);
            let input = scope.spawn(move || {
                let completion = input_completion;
                let result = stdin.write_all(&request.stdin);
                if result.is_err() {
                    let _ = completion.group.kill();
                }
                result
            });
            let mut shutdown = Shutdown::default();
            let mut cancelled = false;
            let started = self.clock.now();
            let child_completion = Completion::new(&child_done, &group);
            let mut waiter = Some(scope.spawn(move || {
                let completion = child_completion;
                let result = completion.group.wait().git();
                if result.is_err() {
                    let _ = completion.group.kill();
                }
                result
            }));
            let mut timed_out = false;
            let mut status = None;
            let mut failure = None;
            while status.is_none()
                || !output_done.load(Ordering::Acquire)
                || !errors_done.load(Ordering::Acquire)
                || !input_done.load(Ordering::Acquire)
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
                    break;
                }
                if child_done.load(Ordering::Acquire)
                    && let Some(waiter) = waiter.take()
                {
                    match joined(waiter.join()) {
                        Ok(value) => status = Some(value),
                        Err(error) => {
                            failure = Some(error);
                            let _ = group.kill();
                            break;
                        }
                    }
                }
                if status.is_none()
                    || !output_done.load(Ordering::Acquire)
                    || !errors_done.load(Ordering::Acquire)
                    || !input_done.load(Ordering::Acquire)
                {
                    self.clock.pause(Duration::from_millis(5));
                }
            }
            if let Some(waiter) = waiter {
                let _ = waiter.join();
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

/// Publish completion before waking supervision, including failed workers.
struct Completion<'a> {
    finished: &'a AtomicBool,
    supervisor: Thread,
    group: Arc<ProcessTree>,
}

impl<'a> Completion<'a> {
    fn new(finished: &'a AtomicBool, group: &Arc<ProcessTree>) -> Self {
        Self {
            finished,
            supervisor: thread::current(),
            group: Arc::clone(group),
        }
    }
}

impl Drop for Completion<'_> {
    fn drop(&mut self) {
        if thread::panicking() {
            let _ = self.group.kill();
        }
        self.finished.store(true, Ordering::Release);
        self.supervisor.unpark();
    }
}

fn joined<T>(result: thread::Result<Result<T>>) -> Result<T> {
    match result {
        Ok(value) => value,
        Err(_) => Err(Error::Internal(InternalError::Worker)),
    }
}

#[cfg(test)]
#[path = "_tests_/system_tests.rs"]
mod system_tests;
