//! CLI parsing and dependency composition.

use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::Arc;

use clap::{Parser, Subcommand};

use crate::application::{Application, Xtask};
use crate::check::request::{DependencyAudit, Shard, VerificationSuite};
use crate::check::runner::DefaultCheckRunner;
use crate::command::{CommandRunner, SystemCommandRunner};
use crate::error::{Error, Result};
use crate::executor::Executor;
use crate::remote::availability::{DefaultSelector, Selector};
use crate::remote::clients::blacksmith::SystemBlacksmith;
use crate::remote::clients::github::SystemGithub;
use crate::remote::contracts::{
    Aggregate, Blacksmith, Clock, Dependencies, Environment, Fingerprint, Git, Github, Interrupt,
    Logs, Programs, Reporter,
};
use crate::remote::logs::SystemLogs;
use crate::remote::process::{Process, SystemProcess};
use crate::remote::runner::DefaultRemoteRunner;
use crate::remote::runtime::{
    SystemClock, SystemEnvironment, SystemInterrupt, SystemProgramFiles, SystemPrograms,
    SystemReporter,
};
use crate::remote::scripts::SystemScripts;
use crate::remote::snapshot::contracts::Snapshot;
use crate::remote::snapshot::filesystem::SystemSnapshotFiles;
use crate::remote::snapshot::system::SystemSnapshot;
use crate::rust_file_length::{RustFileLengthAuditor, SystemRustFileLengthAuditor};

#[derive(Debug, Parser)]
#[command(name = "xtask", about = "Mokly repository automation")]
/// Parsed developer command.
pub(crate) struct Cli {
    /// Selected repository operation.
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
/// Repository task variants.
pub(crate) enum Command {
    /// Run the full gate or one selected verification suite.
    Check {
        /// Run one partial verification suite.
        #[arg(long, value_enum)]
        suite: Option<VerificationSuite>,
        /// Run one one-based whole-file shard of a unit or browser suite.
        #[arg(long, value_name = "INDEX/TOTAL")]
        shard: Option<Shard>,
        /// Select the workspace audit policy for complete or repository checks.
        #[arg(long, value_enum)]
        dependency_audit: Option<DependencyAudit>,
        /// Select auto, local or explicit remote execution.
        #[arg(long, value_enum)]
        executor: Option<Executor>,
    },
    /// Print the available executor without warming boxes or running suites.
    Executor {
        /// Override the default automatic, local or remote mode.
        #[arg(long, value_enum)]
        executor: Option<Executor>,
    },
    /// Enforce the 300-line Rust source limit.
    RustFileLengthLint {
        /// Audit every Rust file; retained for workspace command compatibility.
        #[arg(long)]
        all: bool,
    },
    /// Enforce changed TypeScript/JavaScript and protocol Markdown limits.
    SourceFileLengthLint {
        /// Audit every scoped source/protocol file rather than changed files.
        #[arg(long)]
        all: bool,
    },
}

/// Parse arguments, compose real dependencies, and return a process exit code.
pub(crate) fn main() -> ExitCode {
    let workspace = match workspace_root() {
        Ok(workspace) => workspace,
        Err(error) => {
            let _ = writeln!(io::stderr().lock(), "{error}");
            return ExitCode::FAILURE;
        }
    };
    let command_runner: Arc<dyn CommandRunner> = Arc::new(SystemCommandRunner);
    let rust_file_length_auditor: Arc<dyn RustFileLengthAuditor> =
        Arc::new(SystemRustFileLengthAuditor);
    let dependencies = remote_dependencies(workspace.clone());
    let selector: Arc<dyn Selector + Send + Sync> = Arc::new(DefaultSelector {
        dependencies: dependencies.clone(),
    });
    let app: Arc<dyn Xtask> = Arc::new(Application {
        selector,
        check_runner: Arc::new(DefaultCheckRunner::new(
            command_runner,
            Arc::clone(&rust_file_length_auditor),
            workspace.clone(),
        )),
        rust_file_length_auditor,
        remote_runner: Arc::new(DefaultRemoteRunner {
            dependencies: dependencies.clone(),
        }),
        environment: Arc::clone(&dependencies.environment),
        reporter: Arc::clone(&dependencies.reporter),
        interrupt: Arc::clone(&dependencies.interrupt),
        workspace,
    });
    match app.run(Cli::parse().command) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            let _ = writeln!(io::stderr().lock(), "{error}");
            ExitCode::FAILURE
        }
    }
}

/// Construct every concrete remote collaborator only at this composition root.
fn remote_dependencies(workspace: PathBuf) -> Dependencies {
    let environment: Arc<dyn Environment + Send + Sync> = Arc::new(SystemEnvironment);
    let programs: Arc<dyn Programs + Send + Sync> = Arc::new(SystemPrograms {
        environment: Arc::clone(&environment),
        files: Arc::new(SystemProgramFiles),
    });
    let clock: Arc<dyn Clock + Send + Sync> = Arc::new(SystemClock);
    let interrupt: Arc<dyn Interrupt + Send + Sync> = Arc::new(SystemInterrupt::default());
    let logs: Arc<dyn Logs + Send + Sync> = Arc::new(SystemLogs {
        workspace: workspace.clone(),
    });
    let process: Arc<dyn Process + Send + Sync> = Arc::new(SystemProcess {
        interrupt: Arc::clone(&interrupt),
        clock: Arc::clone(&clock),
        logs: Arc::clone(&logs),
    });
    let scripts = Arc::new(SystemScripts {
        process: Arc::clone(&process),
        workspace: workspace.clone(),
    });
    let git: Arc<dyn Git + Send + Sync> = scripts.clone();
    let fingerprint: Arc<dyn Fingerprint + Send + Sync> = scripts.clone();
    let aggregate: Arc<dyn Aggregate + Send + Sync> = scripts;
    let blacksmith: Arc<dyn Blacksmith + Send + Sync> = Arc::new(SystemBlacksmith {
        process: Arc::clone(&process),
        workspace: workspace.clone(),
        home: environment.get("HOME").map(PathBuf::from),
    });
    let github: Arc<dyn Github + Send + Sync> = Arc::new(SystemGithub {
        process: process.clone(),
        workspace: workspace.clone(),
    });
    let reporter: Arc<dyn Reporter + Send + Sync> = Arc::new(SystemReporter);
    let snapshot: Arc<dyn Snapshot + Send + Sync> = Arc::new(SystemSnapshot {
        process,
        files: Arc::new(SystemSnapshotFiles),
        reporter: reporter.clone(),
        workspace: workspace.clone(),
    });
    Dependencies {
        environment,
        programs,
        clock,
        git,
        snapshot,
        blacksmith,
        github,
        fingerprint,
        aggregate,
        logs,
        interrupt,
        reporter,
        workspace,
    }
}

/// Derive the checkout location from the manifest without ambient I/O.
fn workspace_root() -> Result<PathBuf> {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest
        .parent()
        .map(Path::to_path_buf)
        .ok_or(Error::WorkspaceRoot)
}

#[cfg(test)]
#[path = "_tests_/cli_tests.rs"]
mod cli_tests;
