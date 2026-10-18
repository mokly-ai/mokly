//! Base-ref refresh keeps the current warning attempt and orders warnings before readiness.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_types::{ComparisonCounts, ComparisonResult};
use mokly_model::review::ReviewResultV8;
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use mokly_render::runtime::Runtime;
use mokly_server::changes::ChangeSource;
use unimock::{MockFn, Unimock, matching};

use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_reporter::GitRefreshMock;
use crate::serve_warnings::{ServeWarnings, WarningScopes, WarningScopesMock};
use crate::terminal::TerminalMock;
use crate::warning_support::{config, warning};

#[test]
fn refresh_uses_current_and_cancelled_attempts_print_no_warnings_or_result() {
    let lines = Arc::new(Mutex::new(Vec::new()));
    let output = lines.clone();
    let errors = lines.clone();
    let terminal = Arc::new(Unimock::new((
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                if !text.is_empty() {
                    output.lock().unwrap().push(("out", text.to_owned()));
                }
            })),
        TerminalMock::stderr
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                if !text.is_empty() {
                    errors.lock().unwrap().push(("err", text.to_owned()));
                }
            })),
    )));
    let cancellation: Arc<dyn Cancellation> = Arc::new(ServeCancellation::default());
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 120,
    };
    let redactor = Arc::new(Redactor::default());
    let scopes = ServeWarnings::new(
        cancellation.clone(),
        terminal.clone(),
        style.clone(),
        redactor.clone(),
    );
    let old = scopes.begin();
    let current = scopes.begin();
    let service = Source {
        references: Mutex::new(None),
        operation: Arc::new(CaptureCancellation::default()),
        pending: Arc::new(Mutex::new(Vec::new())),
        config: config(),
        head: Arc::new(Unimock::new(())),
        warnings: old,
        services: ServeChanges {
            sidecars: Arc::new(Unimock::new(())),
            progress: Arc::new(Unimock::new(())),
            cache_announced: Arc::new(false.into()),
            refreshes: Arc::new(Unimock::new(
                GitRefreshMock::refreshing
                    .next_call(matching!("origin/main"))
                    .returns(()),
            )),
            warnings: Arc::new(Unimock::new(
                WarningScopesMock::current
                    .next_call(matching!())
                    .returns(current),
            )),
            runtime: Arc::new(Runtime::new(
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(())),
                "test".into(),
                None,
            )),
            git: Arc::new(Unimock::new(())),
            cancellation: cancellation.clone(),
            terminal,
            style,
            redactor,
            base: None,
        },
    };
    let mut dependency = warning("Uses current dependencies.");
    dependency.code = "base-dependencies";
    let result = ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        validation_lookups: 0,
        warnings: vec![warning("Do not report base composition."), dependency],
        review: ReviewResultV8 {
            schema_version: 8,
            base_commit: "a".repeat(40),
            entries: vec![],
            affected: vec![],
            diagnostics: vec![],
        },
        snapshot: CatalogueChangeSnapshotV4 {
            schema_version: 4,
            base_ref: "base".into(),
            base_commit: "a".repeat(40),
            changed_entries: vec![],
            moved_entries: vec![],
            removed_entries: vec![],
        },
        entries: vec![],
        pairing: Default::default(),
        counts: ComparisonCounts {
            changes: 5,
            moved: 1,
            ignored_only: 2,
        },
        before: Arc::new(Unimock::new(())),
        after: Arc::new(Unimock::new(())),
    };
    let source: &dyn ChangeSource = &service;
    source.finished(Ok(&result), Duration::ZERO);
    assert!(lines.lock().unwrap().is_empty());
    let refreshed = source.refreshed().unwrap();
    refreshed.finished(Ok(&result), Duration::ZERO);
    refreshed.finished(Ok(&result), Duration::ZERO);
    let recorded = lines.lock().unwrap().clone();
    assert_eq!(recorded.len(), 3);
    assert_eq!(recorded[0].0, "err");
    assert!(recorded[0].1.contains("Uses current dependencies."));
    assert!(!recorded[0].1.contains("base composition"));
    assert!(
        recorded[1]
            .1
            .contains("Changes ready · 5 changes · 1 moved · 2 ignored-only")
    );
    assert!(recorded[2].1.contains("Changes ready"));
    cancellation.interrupt();
    refreshed.finished(Ok(&result), Duration::ZERO);
    assert_eq!(*lines.lock().unwrap(), recorded);
}
