//! The real Serve output owner orders one shared cache notice after readiness.

use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, mpsc};

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_compare::cache_types::Reporter;
use mokly_server::changes::ChangeToken;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::cache_directory::ServeDirectory;
use crate::serve_changes_base::CacheNotice;
use crate::serve_progress::{Progress, ServeProgress};
use crate::serve_warnings::{ServeWarnings, WarningScopes};
use crate::terminal::TerminalMock;

const LISTENING: &str = "Mokly listening at http://127.0.0.1:4173\n";

fn style() -> Style {
    Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 80,
    }
}

fn capture(lines: Arc<Mutex<Vec<String>>>) -> Unimock {
    Unimock::new(
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                lines.lock().unwrap().push(text.into())
            })),
    )
}

#[tokio::test]
async fn startup_cache_notice_waits_for_listening_and_shares_one_command_reservation() {
    let lines = Arc::new(Mutex::new(Vec::new()));
    let captured = lines.clone();
    let entered = Arc::new(Notify::new());
    let observed = entered.clone();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let terminal = Unimock::new(TerminalMock::stdout.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, text| {
            captured.lock().unwrap().push(text.to_owned());
            if text == LISTENING {
                observed.notify_one();
                released.lock().unwrap().recv().unwrap();
            }
        }),
    ));
    let cancellation = Arc::new(ServeCancellation::default());
    let progress = Arc::new(ServeProgress::new(
        style(),
        Arc::new(terminal.clone()),
        cancellation.clone(),
        false,
    ));
    let announced = Arc::new(AtomicBool::new(false));
    let redactor = Arc::new(Redactor::default());
    let bundle = ServeDirectory {
        announced: announced.clone(),
        terminal: progress.clone(),
        style: style(),
        redactor: redactor.clone(),
    };
    bundle.opened(Path::new("/cache/project"));
    let before = lines.lock().unwrap().clone();
    let ready = progress.clone();
    let writing = tokio::task::spawn_blocking(move || ready.ready(LISTENING));
    let release = Release(release);
    entered.notified().await;
    let during = lines.lock().unwrap().clone();
    release.0.send(()).unwrap();
    writing.await.unwrap();
    let warnings = ServeWarnings::new(cancellation, progress.clone(), style(), redactor.clone());
    let base = CacheNotice {
        announced,
        warnings: warnings.begin(),
        terminal: progress,
        style: style(),
        redactor,
        cancel: Arc::new(ChangeToken::default()),
    };
    base.opened(Path::new("/cache/project"));
    bundle.opened(Path::new("/cache/project"));
    assert_eq!(
        before,
        Vec::<String>::new(),
        "opening the store must not print before Listening"
    );
    assert_eq!(
        during,
        [LISTENING],
        "the cache notice must wait for the complete readiness write"
    );
    assert_eq!(
        *lines.lock().unwrap(),
        [LISTENING, "Mokly cache: /cache/project\n"]
    );
}

#[test]
fn failed_or_cancelled_startup_drops_the_shared_cache_notice() {
    let lines = Arc::new(Mutex::new(Vec::new()));
    let terminal = capture(lines.clone());
    ServeProgress::new(
        style(),
        Arc::new(terminal.clone()),
        Arc::new(ServeCancellation::default()),
        false,
    )
    .ready(LISTENING);
    assert_eq!(*lines.lock().unwrap(), [LISTENING]);
    lines.lock().unwrap().clear();
    for cancelled in [false, true] {
        {
            let cancellation = Arc::new(ServeCancellation::default());
            let progress = Arc::new(ServeProgress::new(
                style(),
                Arc::new(terminal.clone()),
                cancellation.clone(),
                false,
            ));
            let directory = ServeDirectory {
                announced: Arc::new(AtomicBool::new(false)),
                terminal: progress.clone(),
                style: style(),
                redactor: Arc::new(Redactor::default()),
            };
            directory.opened(Path::new("/cache/project"));
            if cancelled {
                cancellation.interrupt();
                progress.ready(LISTENING);
            }
        }
        assert_eq!(
            *lines.lock().unwrap(),
            Vec::<String>::new(),
            "startup without readiness must keep stdout empty: cancelled={cancelled}"
        );
    }
}

struct Release(mpsc::Sender<()>);
impl Drop for Release {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}

#[test]
fn a_cache_notice_first_opened_after_readiness_prints_immediately_once() {
    let lines = Arc::new(Mutex::new(Vec::new()));
    let terminal = capture(lines.clone());
    let cancellation = Arc::new(ServeCancellation::default());
    let progress = Arc::new(ServeProgress::new(
        style(),
        Arc::new(terminal.clone()),
        cancellation.clone(),
        false,
    ));
    progress.ready(LISTENING);
    let announced = Arc::new(AtomicBool::new(false));
    let redactor = Arc::new(Redactor::default());
    let warnings = ServeWarnings::new(cancellation, progress.clone(), style(), redactor.clone());
    let base = CacheNotice {
        announced: announced.clone(),
        warnings: warnings.begin(),
        terminal: progress.clone(),
        style: style(),
        redactor: redactor.clone(),
        cancel: Arc::new(ChangeToken::default()),
    };
    base.opened(Path::new("/cache/project"));
    let bundle = ServeDirectory {
        announced,
        terminal: progress,
        style: style(),
        redactor,
    };
    bundle.opened(Path::new("/cache/project"));
    assert_eq!(
        *lines.lock().unwrap(),
        [LISTENING, "Mokly cache: /cache/project\n"]
    );
}
