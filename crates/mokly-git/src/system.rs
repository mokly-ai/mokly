//! Host Git adapter with concurrent bounded input and output.

use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use mokly_platform::processes::{ProcessGroup, ProcessGroups};

use crate::command::{DEFAULT_OUTPUT_LIMIT, Output, Request, Runner};
use crate::control::{Cancellation, Clock, Shutdown, Signal};
use crate::error::{Error, InternalError, IoResult, Result};
use crate::pipes::capture;

/// Git process adapter composed with tree ownership, cancellation and time.
pub struct SystemRunner {
    /// Platform group or job-object implementation.
    pub groups: Arc<dyn ProcessGroups>,
    /// Command-generation cancellation.
    pub cancellation: Arc<dyn Cancellation>,
    /// Monotonic supervision clock.
    pub clock: Arc<dyn Clock>,
}

impl Runner for SystemRunner {
    fn run(&self, request: &Request) -> Result<Output> {
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
        if self.cancellation.cancelled() {
            return Err(Error::Cancelled);
        }
        tracing::debug!(
            arguments = request.args.len(),
            "starting bounded Git command"
        );
        let mut command = git_command(request);
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
            let output =
                scope.spawn(move || capture(stdout, request.output_limit, output_group.as_ref()));
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
            let mut status = None;
            let mut failure = None;
            while status.is_none()
                || !output.is_finished()
                || !errors.is_finished()
                || !input.is_finished()
            {
                cancelled |= self.cancellation.cancelled();
                match shutdown.step(self.clock.now(), cancelled) {
                    Some(Signal::Terminate) => {
                        let _ = group.terminate();
                    }
                    Some(Signal::Kill) => {
                        let _ = group.kill();
                    }
                    None => {}
                }
                if status.is_none() {
                    match child.try_wait() {
                        Ok(value) => status = value,
                        Err(source) => {
                            failure = Some(source);
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
            if let Some(source) = failure {
                return Err(Error::Internal(InternalError::Io { source }));
            }
            let _ = group.kill();
            if cancelled {
                return Err(Error::Cancelled);
            }
            let stdout = joined(stdout)?;
            let stderr = joined(stderr)?;
            let Some(status) = status else {
                return Err(Error::Internal(InternalError::Worker));
            };
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

fn git_command(request: &Request) -> Command {
    let mut command = Command::new("git");
    command
        .args(&request.args)
        .current_dir(&request.directory)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for variable in [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_COMMON_DIR",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_NAMESPACE",
        "GIT_PREFIX",
        "GIT_SHALLOW_FILE",
        "GIT_GRAFT_FILE",
        "GIT_REPLACE_REF_BASE",
        "GIT_NO_REPLACE_OBJECTS",
        "GIT_IMPLICIT_WORK_TREE",
    ] {
        command.env_remove(variable);
    }
    command
}

#[cfg(test)]
#[path = "_tests_/system_tests.rs"]
mod system_tests;
