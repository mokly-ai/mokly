//! A base-first bundle cache touch cannot publish a directory or warning before adoption.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::cache_types::Reporter;
use mokly_server::changes::ChangeToken;
use mokly_sidecar::bundle_store::{BundleStore, BundleStoreMock, ReadMiss, ReadOutcome};
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::workers::DiagnosticsMock;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_runtime::Reported;
use crate::cache_directory::ServeDirectory;
use crate::serve_changes_base::CacheNotice;
use crate::serve_eager_diagnostics::{DiagnosticRouting, RootDiagnostics};
use crate::serve_eager_directory::RootDirectory;
use crate::serve_eager_events::{OrderedEvents, PreparationEvents};
use crate::serve_eager_reporting::CurrentPreparation;
use crate::serve_warnings::{ServeWarnings, WarningScopes};
use crate::terminal::TerminalMock;

#[test]
fn eager_base_first_bundle_cache_reports_only_after_adoption() {
    let output = Arc::new(Mutex::new(Vec::new()));
    let lines = output.clone();
    let terminal = Arc::new(Unimock::new(
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                lines.lock().unwrap().push("directory")
            })),
    ));
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: true,
        columns: 120,
    };
    let redactor = Arc::new(Redactor::default());
    let warnings = ServeWarnings::new(
        Arc::new(ServeCancellation::default()),
        terminal.clone(),
        style.clone(),
        redactor.clone(),
    )
    .begin();
    let announced = Arc::new(AtomicBool::new(false));
    let lines = output.clone();
    let routing: Arc<dyn DiagnosticRouting> =
        Arc::new(RootDiagnostics::new(Arc::new(Unimock::new(
            DiagnosticsMock::emit
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| lines.lock().unwrap().push("warning"))),
        ))));
    let events: Arc<dyn PreparationEvents> = Arc::new(OrderedEvents::default());
    routing.prepare(Path::new("/base"), events.clone());
    let directory: Arc<dyn Reporter> = Arc::new(RootDirectory {
        inner: Arc::new(ServeDirectory {
            announced: announced.clone(),
            terminal: terminal.clone(),
            style: style.clone(),
            redactor: redactor.clone(),
        }),
        routing: routing.clone(),
    });
    let reporting = directory.clone();
    let store: &dyn BundleStore = &Reported {
        directory,
        inner: Arc::new(Unimock::new(
            BundleStoreMock::load
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    reporting.opened(Path::new("/cache/project"));
                    ReadOutcome::Miss(ReadMiss::StoreFault)
                })),
        )),
        diagnostics: routing.clone(),
        mode: Mode::Plain,
    };
    let result = store.load(&Bundle {
        evaluation: None,
        entry_files: Vec::new(),
        renderer: None,
        stories_files: Vec::new(),
        source_root: "/base".into(),
        configuration_directory: ".".into(),
        repository_roots: Vec::new(),
        module_resolution: Default::default(),
        vite: false,
        vite_inputs: None,
    });
    let before = output.lock().unwrap().clone();
    let was_announced = announced.load(Ordering::Acquire);
    let cancel = Arc::new(ChangeToken::default());
    let sink = Arc::new(CurrentPreparation {
        steps: Arc::new(Unimock::new(())),
        progress: Arc::new(Unimock::new(())),
        warnings: Arc::default(),
        diagnostics: routing,
        attempt: warnings.clone(),
        cancel: cancel.clone(),
        cache: Arc::new(CacheNotice {
            announced: announced.clone(),
            warnings,
            terminal,
            style,
            redactor,
            cancel,
        }),
    });
    events.adopt(sink).unwrap();
    assert!(matches!(result, ReadOutcome::Miss(ReadMiss::StoreFault)));
    assert_eq!(before, Vec::<&str>::new());
    assert!(
        !was_announced,
        "pending bundle storage must not take the command's directory notice"
    );
    assert!(announced.load(Ordering::Acquire));
    assert_eq!(*output.lock().unwrap(), ["directory", "warning"]);
}
