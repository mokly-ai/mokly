//! Real Serve composition with mocked process, pool, and worker boundaries.

use std::sync::{Arc, Mutex};

use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_git::command::{Runner, RunnerMock};
use mokly_git::error::Error;
use mokly_sidecar::methods::{Call, ProcessCss};
use unimock::{MockFn, Unimock, matching};

use crate::serve_changes::{ServeChanges, Source};
use crate::serve_git::{GitRunnersMock, GitWork, ServeGit};
use crate::serve_pool::PoolScheduling;
use crate::serve_warnings::{ServeWarnings, WarningScopes};
use crate::warning_support::config;

use super::support::Fixture;

/// Use real capture scopes and the production classification runtime composition.
pub(super) fn source(fixture: &Fixture, sidecars: Arc<dyn PoolScheduling>) -> Source {
    let terminal = Arc::new(Unimock::new(()));
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: true,
        columns: 120,
    };
    let redactor = Arc::new(Redactor::default());
    let warnings = ServeWarnings::new(
        fixture.command.clone(),
        terminal.clone(),
        style.clone(),
        redactor.clone(),
    )
    .begin();
    Source {
        references: Mutex::new(None),
        staging: Mutex::new(None),
        operation: fixture.operation.clone(),
        pending: Arc::default(),
        config: config(),
        head: Arc::new(Unimock::new(())),
        warnings,
        services: ServeChanges {
            reuse: Arc::new(MemoryComparisons::new(32 * 1024 * 1024)),
            kept_base: fixture.slot.clone(),
            sidecars,
            progress: Arc::new(Unimock::new(())),
            refreshes: Arc::new(Unimock::new(())),
            cache_announced: Arc::new(false.into()),
            extraction_snapshots: Arc::new(Unimock::new(())),
            warnings: Arc::new(Unimock::new(())),
            runtime: fixture.provider.runtime.clone(),
            git: Arc::new(Unimock::new(())),
            cancellation: fixture.command.clone(),
            terminal,
            style,
            redactor,
            base: None,
            install_scripts: None,
        },
    }
}

/// Track real Serve Git admission while the mocked runner observes its token.
pub(super) fn git(fixture: &Fixture) -> (ServeGit, Arc<dyn Runner>) {
    let git = ServeGit::new(Arc::new(Unimock::new(
        GitRunnersMock::create
            .some_call(matching!(_))
            .answers(&|_, cancellation| {
                let runner: Arc<dyn Runner> = Arc::new(Unimock::new(
                    RunnerMock::checkpoint
                        .each_call(matching!())
                        .answers_arc(Arc::new(move |_| {
                            if cancellation.cancelled() {
                                Err(Error::Cancelled)
                            } else {
                                Ok(())
                            }
                        })),
                ));
                runner
            }),
    )));
    let runner = git.runner(fixture.lifetime.clone());
    (git, runner)
}

/// A sidecar request whose response carries no unrelated document setup.
pub(super) fn call() -> Call {
    Call::ProcessCss(ProcessCss {
        source_root: "/repo".into(),
        context: "kept".into(),
        repository_roots: Vec::new(),
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    })
}
