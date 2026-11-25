//! Verification orchestration through injected process and file auditors.

use std::path::PathBuf;
use std::sync::Arc;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::Result;
use crate::rust_file_length::RustFileLengthAuditor;

use super::commands::{Step, browser_test_command, commands_for, steps_for};
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};
use super::tasks::{Task, task_commands};

/// Runs complete or selected repository verification.
#[cfg_attr(test, unimock::unimock(api = [CheckRunnerRunMock, CheckRunnerTaskMock, CheckRunnerSourceFileLengthMock]))]
pub(crate) trait CheckRunner: Send + Sync {
    /// Execute the validated request in dependency order.
    fn run(&self, request: CheckRequest) -> Result<()>;
    /// Execute deliberate generation or a cloud operator subprocess.
    fn task(&self, task: Task) -> Result<()>;
    /// Audit changed source/protocol files or every scoped file.
    fn source_file_length(&self, all: bool) -> Result<()>;
}

/// Verification implementation backed by injected side-effect boundaries.
pub(crate) struct DefaultCheckRunner {
    command_runner: Arc<dyn CommandRunner>,
    rust_file_length_auditor: Arc<dyn RustFileLengthAuditor>,
    workspace: PathBuf,
}

impl DefaultCheckRunner {
    /// Construct the repository check runner.
    pub(crate) fn new(
        command_runner: Arc<dyn CommandRunner>,
        rust_file_length_auditor: Arc<dyn RustFileLengthAuditor>,
        workspace: PathBuf,
    ) -> Self {
        Self {
            command_runner,
            rust_file_length_auditor,
            workspace,
        }
    }

    /// Runs the suite's steps in order. The repository suite then runs the
    /// Rust file-length audit in this process, not as a subprocess; a failed
    /// audit fails the suite like a failed command.
    fn run_suite(
        &self,
        suite: VerificationSuite,
        shard: Option<Shard>,
        dependency_audit: DependencyAudit,
    ) -> Result<()> {
        let steps = if matches!(
            suite,
            VerificationSuite::CloudRust
                | VerificationSuite::CloudApp
                | VerificationSuite::CloudDesktop
        ) {
            let commands = commands_for(suite, shard, dependency_audit);
            vec![Step::Run(CommandSpec::isolated_database(
                suite.as_str(),
                commands,
            ))]
        } else {
            steps_for(suite, shard, dependency_audit)
        };
        for step in steps {
            match step {
                Step::Run(command) => self.run_command(command)?,
                Step::Concurrent(lanes) => self.run_lanes(lanes)?,
            }
        }
        if suite == VerificationSuite::Repository {
            self.rust_file_length_auditor.run(&self.workspace)?;
        }
        Ok(())
    }

    fn run_command(&self, command: CommandSpec) -> Result<()> {
        self.command_runner
            .run(&command.in_directory(self.workspace.clone()))
    }

    fn run_lanes(&self, lanes: Vec<Vec<CommandSpec>>) -> Result<()> {
        let lanes: Vec<Vec<_>> = lanes
            .into_iter()
            .map(|lane| {
                lane.into_iter()
                    .map(|command| command.in_directory(self.workspace.clone()))
                    .collect()
            })
            .collect();
        self.command_runner.run_concurrently(&lanes)
    }
}

impl CheckRunner for DefaultCheckRunner {
    fn task(&self, task: Task) -> Result<()> {
        for command in task_commands(task) {
            self.run_command(command)?;
        }
        Ok(())
    }

    fn source_file_length(&self, all: bool) -> Result<()> {
        let mut command =
            CommandSpec::new("node").args(["scripts/verification/source-file-length.mjs"]);
        if all {
            command = command.args(["--all"]);
        }
        self.run_command(command)
    }

    /// Runs one selected suite, or every local suite in order. In the complete
    /// gate the Browser step skips its own `npm run build` and reuses the Viewer
    /// suite's build, then also runs the `test:delivery:prepared` check.
    fn run(&self, request: CheckRequest) -> Result<()> {
        if let Some(suite) = request.suite {
            return self.run_suite(suite, request.shard, request.dependency_audit);
        }
        for suite in VerificationSuite::local() {
            if suite == VerificationSuite::Browser {
                self.run_command(browser_test_command(None))?;
                self.run_command(CommandSpec::new("npm").args(["run", "test:delivery:prepared"]))?;
            } else {
                self.run_suite(suite, None, request.dependency_audit)?;
            }
        }
        Ok(())
    }
}
