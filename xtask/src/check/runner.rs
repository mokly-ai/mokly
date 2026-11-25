//! Verification orchestration through injected process and file auditors.

use std::path::PathBuf;
use std::sync::Arc;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::Result;
use crate::rust_file_length::RustFileLengthAuditor;

use super::commands::{Step, browser_test_command, commands_for, steps_for};
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};
use super::rust_commands::{RustPart, cargo_metadata, nextest};
use super::rust_partition::{Piece, Weights, shard_pieces};
use super::rust_targets::test_units;
use super::tasks::{Task, task_commands};

/// Runs complete or selected repository verification.
#[cfg_attr(test, unimock::unimock(api = [CheckRunnerRunMock, CheckRunnerTaskMock, CheckRunnerSourceFileLengthMock, CheckRunnerRustTestShardMock]))]
pub(crate) trait CheckRunner: Send + Sync {
    /// Execute the validated request in dependency order.
    fn run(&self, request: CheckRequest) -> Result<()>;
    /// Execute deliberate generation or a cloud operator subprocess.
    fn task(&self, task: Task) -> Result<()>;
    /// Audit changed source/protocol files or every scoped file.
    fn source_file_length(&self, all: bool) -> Result<()>;
    /// Run the Mokly Rust test units of one weighted test shard.
    fn rust_test_shard(&self, partition: Shard, no_fail_fast: bool) -> Result<()>;
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

    /// Runs the suite's steps in order. A failed command stops the suite
    /// unless it keeps going; the suite then fails with the first failure
    /// after its later steps ran. A repository selection that runs the checks
    /// then runs the Rust file-length audit in this process, not as a
    /// subprocess; a failed audit fails the suite like a failed command.
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
        let mut first_failure = None;
        for step in steps {
            match step {
                Step::Run(command) => {
                    let keep_going = command.keeps_going();
                    match self.run_command(command) {
                        Err(error) if keep_going => {
                            first_failure.get_or_insert(error);
                        }
                        Err(error) => return Err(first_failure.unwrap_or(error)),
                        Ok(()) => {}
                    }
                }
                Step::Concurrent(lanes) => {
                    if let Err(error) = self.run_lanes(lanes) {
                        return Err(first_failure.unwrap_or(error));
                    }
                }
            }
        }
        if let Some(error) = first_failure {
            return Err(error);
        }
        if suite == VerificationSuite::Repository && RustPart::of(shard).runs_checks() {
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

    /// Reads the test units from Cargo metadata and selects the pieces of the
    /// shard. One nextest command runs its whole units, and one more command
    /// runs each slice of a split unit. A shard without pieces runs nothing.
    /// With `no_fail_fast`, every command runs and the first failure returns.
    fn rust_test_shard(&self, partition: Shard, no_fail_fast: bool) -> Result<()> {
        let metadata = self
            .command_runner
            .output(&cargo_metadata().in_directory(self.workspace.clone()))?;
        let pieces = shard_pieces(&test_units(&metadata)?, &Weights::embedded()?, partition);
        if pieces.is_empty() {
            eprintln!("Rust test shard {partition} has no test units");
            return Ok(());
        }
        let whole: Vec<String> = pieces
            .iter()
            .filter(|piece| piece.slice.is_none())
            .flat_map(|piece| piece.unit.args())
            .collect();
        let commands = (!whole.is_empty())
            .then_some(whole)
            .into_iter()
            .chain(pieces.iter().filter_map(Piece::slice_args))
            .map(|targets| nextest(&targets, no_fail_fast));
        let mut first_failure = None;
        for command in commands {
            if let Err(error) = self.run_command(command) {
                if !no_fail_fast {
                    return Err(error);
                }
                first_failure.get_or_insert(error);
            }
        }
        first_failure.map_or(Ok(()), Err)
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
