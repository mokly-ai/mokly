//! Blocking Git lookup and comparison use the command's shared runtime.

use std::sync::Arc;

use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::serial_stylesheets::SerialStylesheets;
use mokly_compare::base_render::{Changes, ChangesService, GitSourceFactory, selected_base};
use mokly_compare::base_selection::GitBaseLookup;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_git::command::Request;
use mokly_git::disk::SystemDisk;
use mokly_git::repository::GitRepositories;
use mokly_git::tree::Limits;
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeCancellation, ChangeProgress};
use mokly_server::error::{Result, ServerError};

use crate::base_dependencies::NativeDependencies;
use crate::changes_base::NativeBase;
use crate::serve_changes::Source;
use crate::serve_changes_base::{AttemptBase, CacheNotice, CombinedCancel, PreparingDependencies};

impl Source {
    /// Resolve HEAD and the selected base to commits and return their merge base.
    /// While both commits stay the same, it returns the cached merge base without running
    /// `merge-base` again, and the equal result keeps the current classification.
    pub(super) fn references_native(&self, cancel: Arc<dyn ChangeCancellation>) -> Result<String> {
        let runner = self.services.git.runner(cancel);
        let mut cached = self
            .references
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut refs = Vec::new();
        for reference in [
            "HEAD",
            selected_base(&self.config, self.services.base.as_deref()),
        ] {
            let request = Request {
                directory: self.config.repo_root.clone(),
                args: [
                    "--no-optional-locks",
                    "rev-parse",
                    "--verify",
                    "--end-of-options",
                    &format!("{reference}^{{commit}}"),
                ]
                .into_iter()
                .map(Into::into)
                .collect(),
                stdin: Vec::new(),
                output_limit: 1024,
                stderr_limit: 1024 * 1024,
            };
            match runner.run(&request) {
                Ok(output) => refs.push(String::from_utf8_lossy(&output.stdout).trim().to_owned()),
                Err(source) => {
                    return Err(ServerError::Comparison {
                        source: Box::new(mokly_compare::error::Error::Git { source }),
                    });
                }
            }
        }
        if let Some((previous, base)) = &*cached
            && previous == &refs
        {
            return Ok(base.clone());
        }
        let request = Request {
            directory: self.config.repo_root.clone(),
            args: ["--no-optional-locks", "merge-base"]
                .into_iter()
                .chain(refs.iter().map(String::as_str))
                .map(Into::into)
                .collect(),
            stdin: Vec::new(),
            output_limit: 1024,
            stderr_limit: 1024 * 1024,
        };
        let output = match runner.run(&request) {
            Ok(output) => output,
            Err(source) => {
                return Err(ServerError::Comparison {
                    source: Box::new(mokly_compare::error::Error::Git { source }),
                });
            }
        };
        let base = String::from_utf8_lossy(&output.stdout).trim().to_owned();
        *cached = Some((refs, base.clone()));
        Ok(base)
    }

    pub(super) fn classify_native(
        &self,
        cancel: Arc<dyn ChangeCancellation>,
        progress: Arc<dyn ChangeProgress>,
    ) -> Result<ComparisonResult> {
        self.pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clear();
        let cancellation = Arc::new(CombinedCancel {
            operation: self.operation.clone(),
            command: self.services.cancellation.clone(),
            generation: cancel.clone(),
        });
        let runtime = self.classification_runtime(cancellation.clone());
        let changes: &dyn ChangesService = &Changes {
            lookup: Arc::new(GitBaseLookup {
                repositories: Arc::new(GitRepositories {
                    runner: self.services.git.runner(cancellation.clone()),
                    disk: Arc::new(SystemDisk),
                }),
            }),
            pinned: None,
            sources: Arc::new(GitSourceFactory {
                limits: Limits::default(),
                batch_bytes: 48 * 1024 * 1024,
            }),
            provider: Arc::new(AttemptBase {
                warnings: self.pending.clone(),
                inner: Arc::new(NativeBase {
                    runtime,
                    cancellation: cancellation.clone(),
                    dependencies: Arc::new(PreparingDependencies {
                        progress: progress.clone(),
                        inner: Arc::new(NativeDependencies {
                            cancellation,
                            reporter: Arc::new(CacheNotice {
                                announced: self.services.cache_announced.clone(),
                                warnings: self.warnings.clone(),
                                terminal: self.services.terminal.clone(),
                                style: self.services.style.clone(),
                                redactor: self.services.redactor.clone(),
                                cancel: cancel.clone(),
                            }),
                        }),
                    }),
                }),
                progress,
            }),
            comparison: Arc::new(Engine {
                moves: Arc::new(Detector),
                css: Arc::new(MemoryParsedCss::new(64 * 1024 * 1024)),
            }),
        };
        match changes.classify(
            &self.config,
            self.services.base.as_deref(),
            self.head.clone(),
            self.services.install_scripts,
        ) {
            Ok(result) if !cancel.cancelled() => Ok(result),
            Ok(_) => Err(ServerError::ChangesReplaced),
            Err(source) => Err(ServerError::Comparison {
                source: Box::new(source),
            }),
        }
    }

    fn classification_runtime(&self, cancellation: Arc<CombinedCancel>) -> Arc<Runtime> {
        let mut runtime = (*self.services.runtime).clone();
        runtime.workers = Arc::new(CancellableWorkers {
            inner: Arc::new(SerialStylesheets {
                inner: runtime.workers.clone(),
            }),
            cancellation: cancellation.clone(),
        });
        runtime.pool = self.services.sidecars.pool(Some(cancellation));
        Arc::new(runtime)
    }
}

#[cfg(test)]
#[path = "_tests_/serve_references_tests.rs"]
mod serve_references_tests;

#[cfg(test)]
#[path = "_tests_/serve_capture_generation_tests.rs"]
mod serve_capture_generation_tests;
