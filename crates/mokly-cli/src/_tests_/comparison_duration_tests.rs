//! Completed comparison phases use injected time and never change plain output.

use std::sync::{Arc, Mutex, mpsc};

use mokly_cli::build::BuildChanges;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::review::ReviewResultV8;
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use mokly_sidecar::workers::ClockMock;
use unimock::{MockFn, Unimock, matching};

use crate::terminal::TerminalMock;

fn ready() -> BuildChanges {
    BuildChanges::Ready(Arc::new(ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        validation_lookups: 0,
        warnings: vec![],
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
        counts: Default::default(),
        before: Arc::new(Unimock::new(())),
        after: Arc::new(Unimock::new(())),
    }))
}

#[test]
fn ready_and_unavailable_comparisons_settle_once_with_their_measured_duration() {
    for mode in [Mode::Rich, Mode::Plain] {
        for (changes, expected) in [
            (ready(), "  + Changes ready · 0 changes (3.2s)\n"),
            (
                BuildChanges::Unavailable {
                    base_ref: "base".into(),
                    base_commit: "base".into(),
                    reason: "base validation failed".into(),
                    diagnostics: vec![],
                },
                "  ! Changes unavailable · base validation failed (3.2s)\n",
            ),
        ] {
            let written = Arc::new(Mutex::new(Vec::new()));
            let capture = written.clone();
            let terminal = Unimock::new((
                TerminalMock::stdout
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, text| {
                        capture.lock().unwrap().push(text.to_owned())
                    })),
                TerminalMock::stderr.next_call(matching!("")).returns(()),
            ));
            let clock = if mode == Mode::Rich {
                Unimock::new((
                    ClockMock::now_ms.next_call(matching!()).returns(1_000_u64),
                    ClockMock::now_ms.next_call(matching!()).returns(4_200_u64),
                ))
            } else {
                Unimock::new(())
            };
            let (stop, _) = mpsc::channel();
            let output = super::Lines {
                clock: Arc::new(clock),
                cwd: "/repo".into(),
                style: Style {
                    mode,
                    color: false,
                    ascii: true,
                    columns: 200,
                },
                redactor: Arc::new(Redactor::default()),
                terminal: Arc::new(terminal),
                state: Arc::new(Mutex::new(super::State::default())),
                stop,
                timer: Mutex::new(None),
                animate: false,
            };
            output.start(Phase::Comparing("base".into()));
            output.changes(&changes);
            output.clear();
            let text = written.lock().unwrap().join("");
            if mode == Mode::Rich {
                assert_eq!(text, format!("  Comparing with base…\n{expected}"));
            } else {
                assert!(text.is_empty());
            }
            let state = output.state.lock().unwrap();
            assert!(state.label.is_none() && state.started.is_none());
        }
    }
}
