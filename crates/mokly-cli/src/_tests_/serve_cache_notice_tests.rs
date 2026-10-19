//! Cache notes print once in plain output without completing a warning attempt.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::cache_types::Reporter;
use mokly_server::changes::ChangeToken;
use unimock::{MockFn, Unimock, matching};

use crate::changes_runtime::cache_line;
use crate::serve_changes_base::CacheNotice;
use crate::serve_warnings::{ServeWarnings, WarningScopes};
use crate::terminal::TerminalMock;
use crate::warning_support::warning;

#[test]
fn plain_cache_notice_is_once_per_command_and_preserves_pending_warnings() {
    let lines = Arc::new(Mutex::new(Vec::new()));
    let captured = lines.clone();
    let terminal = Arc::new(Unimock::new(
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                captured.lock().unwrap().push(text.to_owned())
            }))
            .n_times(1),
    ));
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 80,
    };
    let redactor = Arc::new(Redactor::default());
    let scopes = ServeWarnings::new(
        Arc::new(ServeCancellation::default()),
        terminal.clone(),
        style.clone(),
        redactor.clone(),
    );
    let attempt = scopes.begin();
    attempt.report(&[warning("first")], false);
    let reporter: &dyn Reporter = &CacheNotice {
        announced: Arc::new(false.into()),
        warnings: attempt.clone(),
        terminal,
        style: style.clone(),
        redactor: redactor.clone(),
        cancel: Arc::new(ChangeToken::default()),
    };
    reporter.opened(Path::new("/cache/project"));
    reporter.opened(Path::new("/cache/project"));
    attempt.report(&[warning("second")], false);
    attempt.finish(&[], false, &|records| assert_eq!(records.len(), 2));
    assert_eq!(
        *lines.lock().unwrap(),
        [cache_line(Path::new("/cache/project"), &style, &redactor)]
    );
}
