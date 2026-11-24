//! Serve Changes completion preserves warning ownership and applies the allocator policy.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_catalogue::diagnostic::Warning;
use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_types::{ComparisonCounts, ComparisonResult};
use mokly_graph::document_store::DocumentStoreMock;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::review::ReviewResultV8;
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use mokly_render::runtime::Runtime;
use mokly_server::changes::ChangeSource;
use mokly_server::comparison_graph::FrozenResources;
use mokly_server::error::ServerError;
use unimock::{MockFn, Unimock, matching};

use crate::allocator::PurgeDelayMock;
use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes::{ServeChanges, Source};
use crate::serve_reporter::GitRefreshMock;
use crate::serve_warnings::{ServeWarnings, WarningScopes, WarningScopesMock};
use crate::terminal::{Terminal, TerminalMock};
use crate::warning_support::{config, warning};

use super::serve_reuse_support;

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
    let (mut service, scopes) = source(terminal);
    let current = scopes.begin();
    let resumes = Arc::new(AtomicUsize::new(0));
    let seeds = Arc::new(AtomicUsize::new(0));
    let seeded = seeds.clone();
    let resumed = resumes.clone();
    let documents = Arc::new(Unimock::new(
        DocumentStoreMock::resume
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                resumed.fetch_add(1, Ordering::SeqCst);
            })),
    ));
    service.head = Arc::new(FrozenResources::new(Arc::new(Unimock::new(
        RenderGenerationMock::prepare_render_reuse
            .next_call(matching!())
            .answers_arc(Arc::new(move |_| {
                seeded.fetch_add(1, Ordering::SeqCst);
            })),
    ))));
    service.services.purge_delay = Arc::new(Unimock::new(
        PurgeDelayMock::return_freed_memory_sooner
            .each_call(matching!())
            .returns(()),
    ));
    service.services.refreshes = Arc::new(Unimock::new(
        GitRefreshMock::refreshing
            .next_call(matching!("origin/main"))
            .returns(()),
    ));
    service.services.warnings = Arc::new(Unimock::new(
        WarningScopesMock::current
            .next_call(matching!())
            .returns(current),
    ));
    Arc::get_mut(&mut service.services.runtime)
        .unwrap()
        .document_store = Some(documents);

    let mut dependency = warning("Uses current dependencies.");
    dependency.code = "base-dependencies";
    let result = comparison_result(vec![warning("Do not report base composition."), dependency]);
    serve_reuse_support::checks_ready_admission_and_failed_or_cancelled_staging(&service);
    let source: &dyn ChangeSource = &service;
    source.finished(Ok(&result), Duration::ZERO);
    assert!(lines.lock().unwrap().is_empty());
    let refreshed = source.refreshed().unwrap();
    refreshed.settled();
    assert_eq!(
        seeds.load(Ordering::SeqCst),
        1,
        "post-completion reaches the original wrapped head"
    );
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
    service.services.cancellation.interrupt();
    refreshed.finished(Ok(&result), Duration::ZERO);
    assert_eq!(*lines.lock().unwrap(), recorded);
    assert_eq!(
        resumes.load(Ordering::SeqCst),
        6,
        "ready and unavailable outcomes must both release optional writes"
    );
}

#[test]
fn only_ready_changes_reduce_the_allocator_purge_delay() {
    let terminal = Arc::new(Unimock::new((
        TerminalMock::stdout.each_call(matching!(_)).returns(()),
        TerminalMock::stderr.each_call(matching!(_)).returns(()),
    )));
    let (mut service, _) = source(terminal);
    service.finished(Err(&ServerError::ChangesUnavailable), Duration::ZERO);

    service.services.purge_delay = Arc::new(Unimock::new(
        PurgeDelayMock::return_freed_memory_sooner
            .some_call(matching!())
            .returns(())
            .once(),
    ));
    service.finished(Ok(&comparison_result(vec![])), Duration::ZERO);
}

fn source(terminal: Arc<dyn Terminal>) -> (Source, ServeWarnings) {
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
    let service = Source {
        preparation: None,
        references: Mutex::new(None),
        staging: Mutex::new(None),
        operation: Arc::new(CaptureCancellation::default()),
        pending: Arc::new(Mutex::new(Vec::new())),
        config: config(),
        head: Arc::new(Unimock::new(())),
        warnings: scopes.begin(),
        services: ServeChanges {
            purge_delay: Arc::new(Unimock::new(())),
            routing: None,
            eager: None,
            diagnostics: Arc::new(Unimock::new(())),
            reuse: Arc::new(mokly_compare::comparison_reuse::MemoryComparisons::new(
                32 * 1024 * 1024,
            )),
            kept_base: Arc::default(),
            sidecars: Arc::new(Unimock::new(())),
            progress: Arc::new(Unimock::new(())),
            cache_announced: Arc::new(false.into()),
            extraction_snapshots: Arc::new(
                mokly_compare::extraction_snapshots::ProcessSnapshots::default(),
            ),
            refreshes: Arc::new(Unimock::new(())),
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
            cancellation,
            terminal,
            style,
            redactor,
            base: None,
            install_scripts: None,
        },
    };
    (service, scopes)
}

fn comparison_result(warnings: Vec<Warning>) -> ComparisonResult {
    ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        warnings,
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
    }
}
