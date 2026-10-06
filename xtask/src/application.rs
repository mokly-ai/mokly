//! Trait-backed application dispatch and executor selection.

use std::path::PathBuf;
use std::sync::Arc;

use crate::check::{CheckRequest, CheckRunner};
use crate::cli::Command;
use crate::error::{Error, Result};
use crate::executor::{Executor, resolve_executor};
use crate::remote::contracts::{Environment, Interrupt, Reporter};
use crate::remote::error;
use crate::remote::runner::RemoteRunner;
use crate::rust_file_length::RustFileLengthAuditor;

/// Side-effecting xtask application boundary.
pub(crate) trait Xtask: Send + Sync {
    /// Dispatch a parsed repository task.
    fn run(&self, command: Command) -> Result<()>;
}

/// Application dependencies created by the CLI composition root.
pub(crate) struct Application {
    /// Local gate dispatcher.
    pub(crate) check_runner: Arc<dyn CheckRunner + Send + Sync>,
    /// Complete remote gate dispatcher.
    pub(crate) remote_runner: Arc<dyn RemoteRunner + Send + Sync>,
    /// Rust length audit.
    pub(crate) rust_file_length_auditor: Arc<dyn RustFileLengthAuditor + Send + Sync>,
    /// Environment boundary.
    pub(crate) environment: Arc<dyn Environment + Send + Sync>,
    /// Stable developer output.
    pub(crate) reporter: Arc<dyn Reporter + Send + Sync>,
    /// Interrupt registration boundary.
    pub(crate) interrupt: Arc<dyn Interrupt + Send + Sync>,
    /// Workspace path.
    pub(crate) workspace: PathBuf,
}

impl Xtask for Application {
    fn run(&self, command: Command) -> Result<()> {
        match command {
            Command::Check {
                suite,
                shard,
                executor,
            } => {
                let request = CheckRequest::new(suite, shard)?;
                if executor == Some(Executor::Remote) && suite.is_some() {
                    return Err(Error::Remote {
                        source: error::Error::SelectedSuite,
                    });
                }
                let mode = remote(resolve_executor(
                    executor,
                    self.environment.get("MOKLY_CHECK_EXECUTOR").as_deref(),
                ))?;
                if mode == Executor::Remote {
                    if suite.is_some() {
                        return Err(Error::Remote {
                            source: error::Error::SelectedSuite,
                        });
                    }
                    remote(self.interrupt.arm())?;
                    self.reporter
                        .executor("remote: explicit complete verification");
                    remote(self.remote_runner.run())
                } else {
                    self.reporter.executor(if mode == Executor::Auto {
                        "local: automatic remote selection is pending"
                    } else {
                        "local: explicit local verification"
                    });
                    self.check_runner.run(request)
                }
            }
            Command::RustFileLengthLint { all: _ } => {
                self.rust_file_length_auditor.run(&self.workspace)
            }
            Command::SourceFileLengthLint { all } => self.check_runner.source_file_length(all),
        }
    }
}

/// Promote the remote typed error without converting it to text.
fn remote<T>(result: error::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(Error::Remote { source }),
    }
}

#[cfg(test)]
#[path = "_tests_/application_tests.rs"]
mod application_tests;
