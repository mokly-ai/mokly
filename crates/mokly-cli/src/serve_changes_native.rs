//! Blocking Git lookup and comparison use the command's shared runtime.

use std::sync::{Arc, Mutex};

use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::serial_stylesheets::SerialStylesheets;
use mokly_compare::base_render::{ChangesService, selected_base};
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_reuse::{ReuseAttempt, ReuseFence};
use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_git::command::{ProcessMode, Request};
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeCancellation, ChangeProgress};
use mokly_server::error::{Result, ServerError};

use crate::serve_base_cancel::BaseLifetime;
use crate::serve_changes::Source;
use crate::serve_startup_provider::StartupProvider;

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
                process_mode: ProcessMode::PlainGroup,
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
            process_mode: ProcessMode::PlainGroup,
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
        let comparison = self.comparison_attempt();
        self.pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clear();
        let mut attempt = self.base_changes(
            cancel.clone(),
            Some(progress),
            None,
            self.pending.clone(),
            self.cache_notice(cancel.clone()),
            comparison,
        );
        attempt.changes.provider = Arc::new(StartupProvider {
            inner: attempt.changes.provider.clone(),
            handoff: self.services.startup.clone(),
            head: self.head.clone(),
            cancel: cancel.clone(),
            cancellation: attempt.cancellation.clone(),
            warnings: self.pending.clone(),
            reporter: self.cache_notice(cancel.clone()),
            pending: Mutex::default(),
        });
        match attempt.changes.classify(
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

    pub(super) fn comparison_attempt(&self) -> Arc<dyn ReuseAttempt> {
        let comparison = self.services.reuse.begin(
            Engine {
                moves: Arc::new(Detector),
                css: Arc::new(MemoryParsedCss::new(64 * 1024 * 1024)),
            },
            self.comparison_fence(),
        );
        *self
            .staging
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(comparison.clone());
        comparison
    }

    pub(super) fn comparison_fence(&self) -> Option<ReuseFence> {
        let roots: Vec<_> = self
            .config
            .roots
            .iter()
            .map(|root| (&root.input, &root.directory, &root.identity))
            .collect();
        ReuseFence::new(&(
            &self.config.input,
            &self.config.file,
            &self.config.repo_root,
            &self.config.authored_inputs,
            roots,
            self.services.install_scripts,
        ))
    }

    /// Keep base pool admission and workers on the same detachable lifetime.
    pub(super) fn classification_runtime(
        &self,
        cancellation: Arc<dyn BaseLifetime>,
    ) -> Arc<Runtime> {
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
