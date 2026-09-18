//! CLI parsing and dependency composition.

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::Arc;

use clap::{Parser, Subcommand};

use crate::check::{CheckRequest, CheckRunner, DefaultCheckRunner, Shard, VerificationSuite};
use crate::command::{CommandRunner, SystemCommandRunner};
use crate::error::{Error, Result};
use crate::rust_file_length::{RustFileLengthAuditor, SystemRustFileLengthAuditor};

#[derive(Debug, Parser)]
#[command(name = "xtask", about = "Mokly repository automation")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Run every local verification gate.
    Check {
        /// Run one partial verification suite.
        #[arg(long, value_enum)]
        suite: Option<VerificationSuite>,
        /// Run one one-based whole-file shard of a unit or browser suite.
        #[arg(long, value_name = "INDEX/TOTAL")]
        shard: Option<Shard>,
    },
    /// Enforce the 300-line Rust source limit.
    RustFileLengthLint {
        /// Audit every Rust file; retained for workspace command compatibility.
        #[arg(long)]
        all: bool,
    },
}

/// Side-effecting xtask application boundary.
trait Xtask: Send + Sync {
    /// Dispatch a parsed repository task.
    fn run(&self, command: Command) -> Result<()>;
}

struct Application {
    check_runner: Arc<dyn CheckRunner>,
    rust_file_length_auditor: Arc<dyn RustFileLengthAuditor>,
    workspace: PathBuf,
}

impl Xtask for Application {
    fn run(&self, command: Command) -> Result<()> {
        match command {
            Command::Check { suite, shard } => {
                self.check_runner.run(CheckRequest::new(suite, shard)?)
            }
            Command::RustFileLengthLint { all: _ } => {
                self.rust_file_length_auditor.run(&self.workspace)
            }
        }
    }
}

/// Parse arguments, compose real dependencies, and return a process exit code.
pub(crate) fn main() -> ExitCode {
    let workspace = match workspace_root() {
        Ok(workspace) => workspace,
        Err(error) => {
            eprintln!("{error}");
            return ExitCode::FAILURE;
        }
    };
    let command_runner: Arc<dyn CommandRunner> = Arc::new(SystemCommandRunner);
    let rust_file_length_auditor: Arc<dyn RustFileLengthAuditor> =
        Arc::new(SystemRustFileLengthAuditor);
    let app: Arc<dyn Xtask> = Arc::new(Application {
        check_runner: Arc::new(DefaultCheckRunner::new(
            command_runner,
            Arc::clone(&rust_file_length_auditor),
            workspace.clone(),
        )),
        rust_file_length_auditor,
        workspace,
    });
    match app.run(Cli::parse().command) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}

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
