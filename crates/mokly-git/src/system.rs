//! Host Git adapter with bounded concurrent pipe reads.

use std::io::Read;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use mokly_platform::processes::{ProcessGroup, ProcessGroups};

use crate::command::{Cancellation, DEFAULT_OUTPUT_LIMIT, Output, Request, Runner};
use crate::error::{Error, InternalError, IoResult, Result};

/// Git process adapter composed with process-tree ownership.
pub struct SystemRunner {
    /// Platform group or job-object implementation.
    pub groups: Arc<dyn ProcessGroups>,
}

impl Runner for SystemRunner {
    fn run(&self, request: &Request) -> Result<Output> {
        self.execute(request, None)
    }

    fn run_cancellable(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
    ) -> Result<Output> {
        self.execute(request, Some(cancellation))
    }
}

impl SystemRunner {
    fn execute(
        &self,
        request: &Request,
        cancellation: Option<&dyn Cancellation>,
    ) -> Result<Output> {
        if cancellation.is_some_and(Cancellation::is_cancelled) {
            return Err(Error::Cancelled);
        }
        if request.output_limit > DEFAULT_OUTPUT_LIMIT {
            return Err(Error::InvalidOutputLimit {
                limit: request.output_limit,
                maximum: DEFAULT_OUTPUT_LIMIT,
            });
        }
        tracing::debug!(
            arguments = request.args.len(),
            "starting bounded Git command"
        );
        let mut command = Command::new("git");
        command
            .args(&request.args)
            .current_dir(&request.directory)
            .stdin(Stdio::null())
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
        let (Some(stdout), Some(stderr)) = (child.stdout.take(), child.stderr.take()) else {
            let _ = group.kill();
            let _ = child.wait();
            return Err(Error::Internal(InternalError::Worker));
        };
        let limit = request.output_limit;
        let output_group = Arc::clone(&group);
        let error_group = Arc::clone(&group);
        let output = thread::spawn(move || capture(stdout, limit, output_group.as_ref()));
        let errors = thread::spawn(move || capture(stderr, limit, error_group.as_ref()));
        let status = wait(&mut child, group.as_ref(), cancellation, &|| {
            output.is_finished() && errors.is_finished()
        });
        if status.is_err() {
            let _ = group.kill();
            let _ = child.wait();
        }
        let stdout = output.join();
        let stderr = errors.join();
        let stdout = match stdout {
            Ok(result) => result?,
            Err(_) => return Err(Error::Internal(InternalError::Worker)),
        };
        let stderr = match stderr {
            Ok(result) => result?,
            Err(_) => return Err(Error::Internal(InternalError::Worker)),
        };
        let status = status?;
        if !status.success() {
            return Err(Error::CommandFailed {
                status: status.code(),
                stderr,
            });
        }
        Ok(Output { stdout, stderr })
    }
}

fn wait(
    child: &mut Child,
    group: &dyn ProcessGroup,
    cancellation: Option<&dyn Cancellation>,
    drained: &dyn Fn() -> bool,
) -> Result<ExitStatus> {
    let Some(cancellation) = cancellation else {
        return child.wait().git();
    };
    let mut status = None;
    loop {
        if status.is_none() {
            status = child.try_wait().git()?;
        }
        if let Some(status) = status.filter(|_| drained()) {
            return Ok(status);
        }
        if cancellation.is_cancelled() {
            if let Err(source) = group.terminate() {
                return Err(Error::Platform { source });
            }
            let deadline = Instant::now() + Duration::from_secs(1);
            while Instant::now() < deadline {
                if status.is_none() {
                    status = child.try_wait().git()?;
                }
                thread::sleep(Duration::from_millis(10));
            }
            if let Err(source) = group.kill() {
                return Err(Error::Platform { source });
            }
            if status.is_none() {
                child.wait().git()?;
            }
            return Err(Error::Cancelled);
        }
        thread::sleep(Duration::from_millis(10));
    }
}

fn capture(reader: impl Read, limit: usize, group: &dyn ProcessGroup) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let result = reader
        .take(limit.saturating_add(1) as u64)
        .read_to_end(&mut bytes);
    if result.is_err() || bytes.len() > limit {
        let _ = group.kill();
        result.git()?;
        return Err(Error::OutputLimit { limit });
    }
    Ok(bytes)
}

#[cfg(test)]
#[path = "_tests_/system_tests.rs"]
mod system_tests;
