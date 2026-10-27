//! Verification orchestration through injected process and file auditors.

use std::path::PathBuf;
use std::sync::Arc;

use crate::command::{CommandRunner, CommandSpec};
use crate::error::{Error, Result};
use crate::length::protocol_audit::ProtocolCapAuditor;
use crate::length::source_audit::SourceFileLengthAuditor;
use crate::rust_file_length::RustFileLengthAuditor;

use super::commands::{Step, browser_test_command, commands_for};
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};

/// Runs complete or selected repository verification.
#[cfg_attr(test, unimock::unimock(api = [CheckRunnerRunMock, CheckRunnerSourceFileLengthMock]))]
pub(crate) trait CheckRunner: Send + Sync {
    /// Execute the validated request in dependency order.
    fn run(&self, request: CheckRequest) -> Result<()>;
    /// Audit changed source/protocol files or every scoped file.
    fn source_file_length(&self, all: bool) -> Result<()>;
}

/// The repository audits that run inside xtask instead of as subprocesses.
pub(crate) struct Auditors {
    /// Rust source length below `xtask/` and `crates/`.
    pub(crate) rust_file_length: Arc<dyn RustFileLengthAuditor>,
    /// Changed TypeScript, JavaScript, and protocol page length.
    pub(crate) source_file_length: Arc<dyn SourceFileLengthAuditor>,
    /// Protocol document caps against the comparison commit.
    pub(crate) protocol_caps: Arc<dyn ProtocolCapAuditor>,
}

/// Verification implementation backed by injected side-effect boundaries.
pub(crate) struct DefaultCheckRunner {
    command_runner: Arc<dyn CommandRunner>,
    auditors: Auditors,
    workspace: PathBuf,
}

impl DefaultCheckRunner {
    /// Construct the repository check runner.
    pub(crate) fn new(
        command_runner: Arc<dyn CommandRunner>,
        auditors: Auditors,
        workspace: PathBuf,
    ) -> Self {
        Self {
            command_runner,
            auditors,
            workspace,
        }
    }

    /// Runs the suite's commands in order. The repository suite then runs the
    /// Rust file-length audit in this process, not as a subprocess; a failed
    /// audit fails the suite like a failed command.
    fn run_suite(
        &self,
        suite: VerificationSuite,
        shard: Option<Shard>,
        dependency_audit: DependencyAudit,
    ) -> Result<()> {
        for step in commands_for(suite, shard, dependency_audit) {
            match step {
                Step::Command(command) => self.run_command(command)?,
                Step::SourceFileLength => self.source_file_length(false)?,
                Step::Ratchets(command) => self.run_ratchets(command)?,
            }
        }
        if suite == VerificationSuite::Repository {
            self.auditors.rust_file_length.run(&self.workspace)?;
        }
        Ok(())
    }

    /// Run every ratchet before reporting the first failure.
    fn run_ratchets(&self, command: CommandSpec) -> Result<()> {
        let caps = self.auditors.protocol_caps.run(&self.workspace);
        let others = self.run_command(command);
        match caps {
            Err(source) => Err(Error::Length { source }),
            Ok(()) => others,
        }
    }

    fn run_command(&self, command: CommandSpec) -> Result<()> {
        self.command_runner
            .run(&command.in_directory(self.workspace.clone()))
    }
}

impl CheckRunner for DefaultCheckRunner {
    fn source_file_length(&self, all: bool) -> Result<()> {
        match self.auditors.source_file_length.run(&self.workspace, all) {
            Ok(()) => Ok(()),
            Err(source) => Err(Error::Length { source }),
        }
    }

    /// Runs one selected suite, or every local suite in order. In the complete
    /// gate the Browser step skips its own `npm run build` and reuses the Viewer
    /// suite's build, then also runs the `test:delivery:prepared` check.
    fn run(&self, request: CheckRequest) -> Result<()> {
        if let Some(suite) = request.suite {
            return self.run_suite(suite, request.shard, request.dependency_audit);
        }
        for suite in VerificationSuite::LOCAL {
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
