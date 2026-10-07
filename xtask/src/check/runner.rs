//! Verification orchestration through injected process and file auditors.

use std::path::PathBuf;
use std::sync::Arc;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::Result;
use crate::rust_file_length::RustFileLengthAuditor;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};

/// Runs complete or selected repository verification.
#[cfg_attr(test, unimock::unimock(api = [CheckRunnerRunMock, CheckRunnerSourceFileLengthMock]))]
pub(crate) trait CheckRunner: Send + Sync {
    /// Execute the validated request in dependency order.
    fn run(&self, request: CheckRequest) -> Result<()>;
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

    fn run_suite(
        &self,
        suite: VerificationSuite,
        shard: Option<Shard>,
        dependency_audit: DependencyAudit,
    ) -> Result<()> {
        for command in commands_for(suite, shard, dependency_audit) {
            self.run_command(command)?;
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
}

impl CheckRunner for DefaultCheckRunner {
    fn source_file_length(&self, all: bool) -> Result<()> {
        let mut command =
            CommandSpec::new("node").args(["scripts/verification/source-file-length.mjs"]);
        if all {
            command = command.args(["--all"]);
        }
        self.run_command(command)
    }

    fn run(&self, request: CheckRequest) -> Result<()> {
        if let Some(suite) = request.suite {
            return self.run_suite(suite, request.shard, request.dependency_audit);
        }
        for suite in VerificationSuite::ALL {
            self.run_suite(suite, None, request.dependency_audit)?;
        }
        Ok(())
    }
}
