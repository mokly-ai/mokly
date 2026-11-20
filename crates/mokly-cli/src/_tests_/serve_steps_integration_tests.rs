//! Serve composition integration with real root canonicalization and mocked Git and terminal IO.

use std::sync::{Arc, Mutex};

use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_compare::comparison_steps::Step;
use mokly_compare::error::Error;
use mokly_compare::extraction_snapshots::ProcessSnapshots;
use mokly_git::command::{Runner, RunnerMock};
use mokly_git::error;
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeCancellation, ChangeSource, ChangeToken};
use mokly_server::error::ServerError;
use mokly_sidecar::pool::SidecarPool;
use unimock::{MockFn, Unimock, matching};

use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_git::GitWorkMock;
use crate::serve_pool::PoolSchedulingMock;
use crate::serve_progress::ProgressMock;
use crate::warning_support::{config, scopes};

#[test]
fn classification_reports_reading_with_its_own_token_before_the_first_git_command_fails() {
    let cancel: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let observed = Arc::new(Mutex::new(None));
    let recorded = observed.clone();
    let boundaries = Unimock::new((
        ProgressMock::step
            .next_call(matching!(_, Step::Reading))
            .answers_arc(Arc::new(move |_, cancel, _| {
                *recorded.lock().unwrap() = Some(cancel.clone());
            })),
        RunnerMock::run
            .next_call(matching!(_))
            .returns(Err(error::Error::MalformedOutput)),
    ));
    let runner: Arc<dyn Runner> = Arc::new(boundaries.clone());
    let pool: Arc<dyn SidecarPool> = Arc::new(Unimock::new(()));
    let terminal = Unimock::new(());
    let mut config = config();
    config.repo_root = env!("CARGO_MANIFEST_DIR").into();
    let source = Source {
        references: Mutex::new(None),
        staging: Mutex::new(None),
        operation: Arc::new(CaptureCancellation::default()),
        pending: Arc::default(),
        config,
        head: Arc::new(Unimock::new(())),
        warnings: scopes(&terminal).begin(),
        services: ServeChanges {
            reuse: Arc::new(MemoryComparisons::new(32 * 1024 * 1024)),
            kept_base: Arc::default(),
            sidecars: Arc::new(Unimock::new((
                PoolSchedulingMock::pool
                    .some_call(matching!(Some(_)))
                    .returns(pool),
                PoolSchedulingMock::limit
                    .some_call(matching!())
                    .returns(1_usize),
            ))),
            progress: Arc::new(boundaries.clone()),
            refreshes: Arc::new(Unimock::new(())),
            cache_announced: Arc::new(false.into()),
            extraction_snapshots: Arc::new(ProcessSnapshots::default()),
            warnings: Arc::new(Unimock::new(())),
            runtime: Arc::new(Runtime::new(
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                "test".into(),
                None,
            )),
            git: Arc::new(Unimock::new(
                GitWorkMock::runner.some_call(matching!(_)).returns(runner),
            )),
            cancellation: Arc::new(ServeCancellation::default()),
            terminal: Arc::new(terminal.clone()),
            style: Style {
                mode: Mode::Plain,
                color: false,
                ascii: true,
                columns: 120,
            },
            redactor: Arc::new(Redactor::default()),
            base: None,
            install_scripts: None,
        },
    };
    assert!(matches!(
        source.classify(cancel.clone(), Arc::new(Unimock::new(()))),
        Err(ServerError::Comparison { source })
            if matches!(*source, Error::Git { source: error::Error::MalformedOutput })
    ));
    assert!(Arc::ptr_eq(
        observed.lock().unwrap().as_ref().unwrap(),
        &cancel
    ));
}
