//! Projection and attachment failures flush prepared warnings before the action line.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::{Code, Issue, Warning, WarningSubject};
use mokly_catalogue::error::CatalogueError;
use mokly_cli::build::BuildError;
use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_model::catalogue::SourceLocation;
use mokly_server::error::ServerError;
use mokly_watch::event::Batch;
use tokio::sync::mpsc;
use unimock::{MockFn, Unimock, matching};

use crate::serve_rebuild::RebuildReporter;
use crate::terminal::TerminalMock;

use super::ServeLines;

#[test]
fn server_failures_keep_the_prepared_warning_scope_and_failure_layout() {
    let captured = Arc::new(Mutex::new(String::new()));
    let terminal = Unimock::new(TerminalMock::stderr.next_call(matching!(_)).answers_arc(
        Arc::new({
            let captured = captured.clone();
            move |_, text| *captured.lock().unwrap() = text.into()
        }),
    ));
    let reporter = ServeLines {
        rebuild: Some(mpsc::channel(1).0),
        cwd: PathBuf::from("/repo"),
        cancellation: Arc::new(ServeCancellation::default()),
        terminal: Arc::new(terminal.clone()),
        style: Style {
            mode: Mode::Rich,
            color: false,
            ascii: false,
            columns: 200,
        },
        redactor: Arc::new(Redactor::default()),
    };
    let warnings = [Warning {
        code: "html-unused-props",
        subject: WarningSubject::Entry("home".into()),
        message: "unused authored prop".into(),
    }];
    reporter.watched_server_failure(
        &Batch::default(),
        Path::new("/repo"),
        &warnings,
        &ServerError::InvalidAssets,
    );
    let text = captured.lock().unwrap();
    assert!(text.find("unused authored prop").unwrap() < text.find("✖").unwrap());
    assert!(
        text.contains("\n            [mokly/server-failed]"),
        "{text}"
    );
    assert!(text.ends_with("            The last good catalogue is still being served.\n"));
}

#[test]
fn catalogue_failures_keep_plain_compatibility_and_rich_source_diagnostics() {
    for mode in [Mode::Plain, Mode::Rich] {
        let captured = Arc::new(Mutex::new(String::new()));
        let written = captured.clone();
        let terminal = Unimock::new(TerminalMock::stderr.next_call(matching!(_)).answers_arc(
            Arc::new(move |_, text| *written.lock().unwrap() = text.into()),
        ));
        let reporter = ServeLines {
            rebuild: Some(mpsc::channel(1).0),
            cwd: PathBuf::from("/repo"),
            cancellation: Arc::new(ServeCancellation::default()),
            terminal: Arc::new(terminal),
            style: Style {
                mode,
                color: false,
                ascii: false,
                columns: 200,
            },
            redactor: Arc::new(Redactor::default()),
        };
        let error = BuildError::Catalogue {
            source: CatalogueError::Invalid {
                warnings: vec![],
                issues: vec![Issue::new(Code::HtmlElement, "unknown element ui-hero").at(
                    SourceLocation {
                        path: "specs/home.screen.html".into(),
                        line: 12,
                        column: 5,
                        export: None,
                    },
                )],
            },
        };
        reporter.watched_catalogue_failure(&Batch::default(), Path::new("/repo"), &[], &error);
        let text = captured.lock().unwrap();
        if mode == Mode::Plain {
            assert_eq!(
                *text,
                "[mokly/build-invalid] specs/home.screen.html:12:5: [mokly/html-element] unknown element ui-hero\n"
            );
        } else {
            assert!(text.contains("\n            specs/home.screen.html:12:5 [mokly/html-element] unknown element ui-hero\n"), "{text}");
            assert!(!text.contains("[mokly/build-invalid]"), "{text}");
        }
    }
}
