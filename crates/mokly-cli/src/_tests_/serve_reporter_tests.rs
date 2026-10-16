//! Projection and attachment failures flush prepared warnings before the action line.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_server::error::ServerError;
use mokly_watch::event::Batch;
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
