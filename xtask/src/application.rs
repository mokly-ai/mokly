//! Trait-backed application dispatch and executor selection.

use std::path::PathBuf;
use std::sync::Arc;

use crate::check::{CheckRequest, CheckRunner};
use crate::cli::Command;
use crate::error::{Error, Result};
use crate::executor::{Decision, Executor, LocalReason, resolve_executor};
use crate::remote::availability::Selector;
use crate::remote::contracts::{Environment, Interrupt, Reporter};
use crate::remote::error;
use crate::remote::reporting::warning;
use crate::remote::runner::{Failure, RemoteRunner};
use crate::rust_file_length::RustFileLengthAuditor;

/// Side-effecting xtask application boundary.
pub(crate) trait Xtask: Send + Sync {
    /// Dispatch a parsed repository task.
    fn run(&self, command: Command) -> Result<()>;
}

/// Application dependencies created by the CLI composition root.
pub(crate) struct Application {
    /// Ordered availability selector.
    pub(crate) selector: Arc<dyn Selector + Send + Sync>,
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
                if mode == Executor::Remote && suite.is_some() {
                    return Err(Error::Remote {
                        source: error::Error::SelectedSuite,
                    });
                }
                if suite.is_some() || mode == Executor::Local {
                    return self.local(
                        request,
                        if suite.is_some() {
                            LocalReason::Suite
                        } else {
                            LocalReason::Requested
                        },
                    );
                }
                match remote(self.selector.select(mode))? {
                    Decision::Local(reason) => self.local(request, reason),
                    Decision::Remote => {
                        remote(self.interrupt.arm())?;
                        self.reporter.executor(&Decision::Remote.to_string());
                        match self.remote_runner.run() {
                            Ok(()) => Ok(()),
                            Err(Failure::Unavailable(source)) if mode == Executor::Auto => {
                                self.interrupt.release();
                                if self.interrupt.requested()
                                    || matches!(source, error::Error::Interrupted { .. })
                                {
                                    return Err(Error::Remote {
                                        source: error::Error::Interrupted { cleanup: 0 },
                                    });
                                }
                                self.reporter
                                    .executor(&warning("remote preparation unavailable", &source));
                                self.local(request, LocalReason::Preparation)
                            }
                            Err(Failure::Unavailable(source) | Failure::Failed(source)) => {
                                Err(Error::Remote { source })
                            }
                        }
                    }
                }
            }
            Command::Executor { executor } => {
                let mode = remote(resolve_executor(
                    executor,
                    self.environment.get("MOKLY_CHECK_EXECUTOR").as_deref(),
                ))?;
                let decision = remote(self.selector.select(mode))?;
                self.reporter.decision(decision);
                Ok(())
            }
            Command::RustFileLengthLint { all: _ } => {
                self.rust_file_length_auditor.run(&self.workspace)
            }
            Command::SourceFileLengthLint { all } => self.check_runner.source_file_length(all),
        }
    }
}

impl Application {
    /// Announce and execute a complete or selected local request.
    fn local(&self, request: CheckRequest, reason: LocalReason) -> Result<()> {
        self.reporter.executor(&Decision::Local(reason).to_string());
        self.check_runner.run(request)
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

#[cfg(test)]
#[path = "_tests_/fallback_tests.rs"]
mod fallback_tests;
