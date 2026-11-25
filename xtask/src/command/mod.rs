//! Injected subprocess boundary used by repository tasks.

use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::{env, iter};

use crate::child_environment::{GIT_REPOSITORY_VARIABLES, SECRET_VARIABLES};
use crate::error::{Error, Result};

mod capture;

/// One deterministic subprocess invocation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct CommandSpec {
    program: String,
    args: Vec<String>,
    cwd: Option<PathBuf>,
    input: Option<String>,
    environment: Vec<(String, Option<String>)>,
    keep_going: bool,
}

impl CommandSpec {
    /// Create a command for one executable.
    pub(crate) fn new(program: impl Into<String>) -> Self {
        Self {
            program: program.into(),
            args: Vec::new(),
            cwd: None,
            input: None,
            environment: Vec::new(),
            keep_going: false,
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

    /// Execute this command through the strict suite output validator.
    pub(crate) fn reject_skips(mut self) -> Self {
        let mut args = vec!["xtask/scripts/strict-command.mjs".to_owned(), self.program];
        args.extend(self.args);
        self.program = "node".to_owned();
        self.args = args;
        self
    }

    /// Execute a suite's commands with one disposable PostgreSQL database.
    pub(crate) fn isolated_database(suite: &str, commands: Vec<Self>) -> Self {
        let plan: Vec<_> = commands
            .into_iter()
            .map(|command| {
                serde_json::json!({
                    "program": command.program,
                    "args": command.args,
                    "environment": command.environment,
                })
            })
            .collect();
        Self::new("node").args([
            "xtask/scripts/isolated-postgres.mjs",
            suite,
            &serde_json::Value::from(plan).to_string(),
        ])
    }

    /// Supply standard input for a captured generator command.
    pub(crate) fn with_input(mut self, input: String) -> Self {
        self.input = Some(input);
        self
    }

    /// Set or remove an environment value for this child alone.
    pub(crate) fn with_environment(mut self, name: &str, value: Option<&str>) -> Self {
        self.environment
            .push((name.to_owned(), value.map(str::to_owned)));
        self
    }

    /// Let the later commands of a suite run after this command fails. The
    /// suite still fails with this command's error.
    pub(crate) fn keep_going(mut self) -> Self {
        self.keep_going = true;
        self
    }

    /// Whether the later commands of a suite run after this command fails.
    pub(crate) fn keeps_going(&self) -> bool {
        self.keep_going
    }

    /// Inspect the working directory without changing the display command.
    pub(crate) fn working_directory(&self) -> Option<&Path> {
        self.cwd.as_deref()
    }

    /// Format the command for developer-facing output.
    pub(crate) fn display(&self) -> String {
        iter::once(self.program.as_str())
            .chain(self.args.iter().map(String::as_str))
            .map(shell_quote)
            .collect::<Vec<_>>()
            .join(" ")
    }
}

/// Runs subprocesses for an xtask operation.
#[cfg_attr(test, unimock::unimock(api = [CommandRunnerRunMock, CommandRunnerOutputMock]))]
pub(crate) trait CommandRunner: Send + Sync {
    /// Run a command and require a successful status.
    fn run(&self, spec: &CommandSpec) -> Result<()>;
    /// Capture successful stdout and preserve both streams on failure.
    fn output(&self, spec: &CommandSpec) -> Result<String>;
}

/// Operating-system subprocess implementation.
pub(crate) struct SystemCommandRunner;

impl CommandRunner for SystemCommandRunner {
    fn output(&self, spec: &CommandSpec) -> Result<String> {
        capture::output(spec)
    }

    fn run(&self, spec: &CommandSpec) -> Result<()> {
        eprintln!("$ {}", spec.display());
        let mut command = build_command(spec);
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

/// Configure a subprocess without starting it or reading ambient state.
fn build_command(spec: &CommandSpec) -> Command {
    let mut command = Command::new(program_for_platform(&spec.program, env::consts::OS));
    command.args(spec.args.iter().map(OsStr::new));
    if let Some(directory) = spec.working_directory() {
        command.current_dir(directory);
    }
    for name in GIT_REPOSITORY_VARIABLES {
        command.env_remove(name);
    }
    for name in SECRET_VARIABLES {
        command.env_remove(name);
    }
    for (name, value) in &spec.environment {
        match value {
            Some(value) => command.env(name, value),
            None => command.env_remove(name),
        };
    }
    command
}

/// Select installed Node command shims without changing arguments or explicit paths.
pub(crate) fn program_for_platform<'a>(program: &'a str, os: &str) -> &'a str {
    match (os, program) {
        ("windows", "npm") => "npm.cmd",
        ("windows", "npx") => "npx.cmd",
        ("windows", "corepack") => "corepack.cmd",
        ("windows", "pnpm") => "pnpm.cmd",
        ("windows", "pnpx") => "pnpx.cmd",
        ("windows", "yarn") => "yarn.cmd",
        ("windows", "yarnpkg") => "yarnpkg.cmd",
        _ => program,
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
#[path = "../_tests_/command_tests.rs"]
mod command_tests;

#[cfg(test)]
#[path = "../_tests_/command_environment_tests.rs"]
mod command_environment_tests;
