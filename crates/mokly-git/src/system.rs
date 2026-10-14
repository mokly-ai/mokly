//! Host Git adapter with bounded concurrent pipe reads.

use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::thread;

use mokly_platform::processes::{ProcessGroup, ProcessGroups};

use crate::command::{Output, Request, Runner};
use crate::error::{Error, InternalError, IoResult, Result};

/// Git process adapter composed with process-tree ownership.
pub struct SystemRunner {
    /// Platform group or job-object implementation.
    pub groups: Arc<dyn ProcessGroups>,
}

impl Runner for SystemRunner {
    fn run(&self, request: &Request) -> Result<Output> {
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
        let status = child.wait().git();
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
