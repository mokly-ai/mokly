//! Injected subprocess boundary used by repository tasks.

use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::{Error, Result};

/// One deterministic subprocess invocation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct CommandSpec {
    program: String,
    args: Vec<String>,
    cwd: Option<PathBuf>,
}

impl CommandSpec {
    /// Create a command for one executable.
    pub(crate) fn new(program: impl Into<String>) -> Self {
        Self {
            program: program.into(),
            args: Vec::new(),
            cwd: None,
        }
    }

    /// Append command arguments.
    pub(crate) fn args(mut self, args: impl IntoIterator<Item = impl Into<String>>) -> Self {
        self.args.extend(args.into_iter().map(Into::into));
        self
    }

    /// Set the working directory for one repository subprocess.
    pub(crate) fn in_directory(mut self, directory: impl Into<PathBuf>) -> Self {
        self.cwd = Some(directory.into());
        self
    }

    /// Inspect the working directory without changing the display command.
    pub(crate) fn working_directory(&self) -> Option<&Path> {
        self.cwd.as_deref()
    }

    /// Format the command for developer-facing output.
    pub(crate) fn display(&self) -> String {
        std::iter::once(self.program.as_str())
            .chain(self.args.iter().map(String::as_str))
            .map(shell_quote)
            .collect::<Vec<_>>()
            .join(" ")
    }
}

/// Runs subprocesses for an xtask operation.
#[cfg_attr(test, unimock::unimock(api = [CommandRunnerRunMock]))]
pub(crate) trait CommandRunner: Send + Sync {
    /// Run a command and require a successful status.
    fn run(&self, spec: &CommandSpec) -> Result<()>;
}

/// Operating-system subprocess implementation.
pub(crate) struct SystemCommandRunner;

impl CommandRunner for SystemCommandRunner {
    fn run(&self, spec: &CommandSpec) -> Result<()> {
        eprintln!("$ {}", spec.display());
        let mut command = Command::new(&spec.program);
        command.args(spec.args.iter().map(OsStr::new));
        if let Some(directory) = spec.working_directory() {
            command.current_dir(directory);
        }
        let status = match command.status() {
            Ok(status) => status,
            Err(source) => {
                return Err(Error::CommandStart {
                    command: spec.display(),
                    source,
                });
            }
        };
        if !status.success() {
            return Err(Error::CommandFailed {
                command: spec.display(),
                status: status.code().map_or_else(
                    || "terminated by signal".to_owned(),
                    |code| code.to_string(),
                ),
            });
        }
        Ok(())
    }
}

fn shell_quote(value: &str) -> String {
    if value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '/' | '.' | ':' | '='))
    {
        value.to_owned()
    } else {
        format!("{value:?}")
    }
}

#[cfg(test)]
#[path = "_tests_/command_tests.rs"]
mod command_tests;
