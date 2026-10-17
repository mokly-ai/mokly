//! Startup and fatal Serve failures preserve warning order and recovery paths.

use std::sync::{Arc, Mutex};

use mokly_cli::build::BuildError;
use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_static::error::Error;
use unimock::{MockFn, Unimock, matching};

use crate::serve_reporter::ServeLines;
use crate::serve_warnings::{ServeWarnings, WarningScopes};
use crate::terminal::TerminalMock;
use crate::warning_support::{invalid, warning};

fn reporter(mode: Mode, writes: bool) -> (ServeLines, Arc<Mutex<String>>, Arc<ServeCancellation>) {
    let output = Arc::new(Mutex::new(String::new()));
    let written = output.clone();
    let terminal = if writes {
        Unimock::new(
            TerminalMock::stderr
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, text| {
                    written.lock().unwrap().push_str(text)
                })),
        )
    } else {
        Unimock::new(())
    };
    let cancellation = Arc::new(ServeCancellation::default());
    (
        ServeLines {
            cwd: "/repo".into(),
            cancellation: cancellation.clone(),
            terminal: Arc::new(terminal),
            style: Style {
                mode,
                color: false,
                ascii: false,
                columns: 80,
            },
            redactor: Arc::new(Redactor::default()),
        },
        output,
        cancellation,
    )
}

fn scopes(reporter: &ServeLines) -> Arc<dyn WarningScopes> {
    Arc::new(ServeWarnings::new(
        reporter.cancellation.clone(),
        reporter.terminal.clone(),
        reporter.style.clone(),
        reporter.redactor.clone(),
    ))
}

#[test]
fn preparation_failed_sorts_pending_and_error_records_before_the_failure_once() {
    for mode in [Mode::Plain, Mode::Rich] {
        let (reporter, output, _) = reporter(mode, true);
        let scopes = scopes(&reporter);
        let attempt = scopes.begin();
        attempt.report(&[warning("z")], false);
        reporter.preparation_failed(
            attempt.as_ref(),
            &BuildError::Catalogue {
                source: invalid(vec![warning("a"), warning("z")]),
            },
        );
        let prefix = if mode == Mode::Plain {
            "[mokly/warning]"
        } else {
            "  !"
        };
        let output = output.lock().unwrap();
        assert!(output.starts_with(&format!(
            "{prefix} entry \"home\": a\n{prefix} entry \"home\": z\n"
        )));
        assert_eq!(output.matches(&format!("{prefix} entry")).count(), 2);
        assert!(output.contains("[mokly/build-invalid]"));
        assert!(!output.contains("Catalogue ready"));
        assert!(!output.contains("last good"));
    }
}

#[test]
fn preparation_failed_retains_full_recovery_paths_in_both_modes() {
    for mode in [Mode::Plain, Mode::Rich] {
        let (reporter, output, _) = reporter(mode, true);
        let scopes = scopes(&reporter);
        let path = format!("recovery/{}", "long-name".repeat(20));
        reporter.preparation_failed(
            scopes.begin().as_ref(),
            &BuildError::Cleanup {
                primary: Box::new(BuildError::Viewer),
                cleanup: Box::new(Error::Empty),
                path: format!("/repo/{path}").into(),
            },
        );
        assert!(
            output
                .lock()
                .unwrap()
                .ends_with(&format!("  Recovery path: {path}\n"))
        );
    }
}

#[test]
fn fatal_server_failure_does_not_flush_cancelled_attempts() {
    let (reporter, output, cancellation) = reporter(Mode::Plain, false);
    let scopes = scopes(&reporter);
    let startup = scopes.begin();
    startup.report(&[warning("startup")], false);
    let rebuild = scopes.begin();
    rebuild.report(&[warning("current")], false);
    cancellation.interrupt();
    reporter.terminating_failure(scopes.as_ref());
    startup.report(&[warning("late")], true);
    rebuild.report(&[warning("cancelled")], true);
    assert!(output.lock().unwrap().is_empty());
}

#[test]
fn fatal_startup_failure_flushes_pending_warnings_before_cancellation() {
    let (reporter, output, _) = reporter(Mode::Plain, true);
    let scopes = scopes(&reporter);
    let startup = scopes.begin();
    startup.report(&[warning("startup")], false);
    reporter.terminating_failure(scopes.as_ref());
    assert_eq!(
        *output.lock().unwrap(),
        "[mokly/warning] entry \"home\": startup\n"
    );
}

#[test]
fn terminating_failure_selects_the_current_handle() {
    let (reporter, output, _) = reporter(Mode::Plain, true);
    let scopes = scopes(&reporter);
    let startup = scopes.begin();
    startup.report(&[warning("startup")], false);
    let current = scopes.begin();
    current.report(&[warning("current")], false);
    reporter.terminating_failure(scopes.as_ref());
    assert_eq!(
        *output.lock().unwrap(),
        "[mokly/warning] entry \"home\": current\n"
    );
}
