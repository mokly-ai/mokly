//! Committed Changes completion records one return after its output is accepted.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_compare::extraction_snapshots::ProcessSnapshots;
use mokly_render::runtime::Runtime;
use mokly_server::changes::ChangeSource;
use mokly_server::error::ServerError;
use unimock::{MockFn, Unimock, matching};

use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_pool::BaseCompletionMock;
use crate::terminal::TerminalMock;
use crate::warning_support::{config, scopes};

#[test]
fn unavailable_completion_signals_the_return_after_reporting() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let stdout = events.clone();
    let stderr = events.clone();
    let terminal = Unimock::new((
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                stdout.lock().unwrap().push("output");
            })),
        TerminalMock::stderr
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                stderr.lock().unwrap().push("error");
            })),
    ));
    let returned = events.clone();
    let scheduling = Unimock::new(
        BaseCompletionMock::base_finished
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                returned.lock().unwrap().push("return");
            })),
    );
    let source = Source {
        preparation: None,
        staging: Mutex::new(None),
        references: Mutex::new(None),
        operation: Arc::new(CaptureCancellation::default()),
        pending: Arc::default(),
        config: config(),
        head: Arc::new(Unimock::new(())),
        warnings: scopes(&terminal).begin(),
        services: ServeChanges {
            purge_delay: Arc::new(Unimock::new(())),
            routing: None,
            eager: None,
            diagnostics: Arc::new(Unimock::new(())),
            reuse: Arc::new(MemoryComparisons::new(32 * 1024 * 1024)),
            kept_base: Arc::default(),
            sidecars: Arc::new(scheduling.clone()),
            progress: Arc::new(Unimock::new(())),
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
            git: Arc::new(Unimock::new(())),
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
    let source: &dyn ChangeSource = &source;
    source.finished(Err(&ServerError::ChangesUnavailable), Duration::ZERO);
    assert_eq!(events.lock().unwrap().last(), Some(&"return"));
}
