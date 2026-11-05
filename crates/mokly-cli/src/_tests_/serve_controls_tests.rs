//! Cross-platform key events execute each shortcut only on a press.

use std::io;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use tokio::sync::{mpsc, watch};
use unimock::{MockFn, Unimock, matching};

use super::{Controls, Input, KeyboardInputMock, Shortcut, shortcut};

fn reader_stops_without_stopping_serve(closed: bool) {
    let reads = Arc::new(AtomicUsize::new(0));
    let observed = reads.clone();
    let input = Unimock::new(
        KeyboardInputMock::read
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                if observed.fetch_add(1, Ordering::SeqCst) > 0 {
                    return Ok(Input::Key(KeyEvent::new(
                        KeyCode::Char('q'),
                        KeyModifiers::NONE,
                    )));
                }
                if closed {
                    Ok(Input::Closed)
                } else {
                    Err(io::ErrorKind::BrokenPipe.into())
                }
            })),
    );
    let (stop, stopped) = watch::channel(false);
    let (rebuild, _requests) = mpsc::channel(1);
    let controls = Controls {
        stop,
        rebuild,
        url: "http://127.0.0.1:4173".into(),
        layout: String::new(),
        style: Style {
            mode: Mode::Rich,
            color: false,
            ascii: false,
            columns: 80,
        },
        redactor: Arc::new(Redactor::default()),
        terminal: Arc::new(Unimock::new(())),
    };
    controls.read(&input);
    assert_eq!(reads.load(Ordering::SeqCst), 1, "input was retried");
    assert!(!*stopped.borrow(), "EOF must not stop Serve");
}

#[test]
fn stdin_eof_stops_the_reader_without_stopping_serve() {
    reader_stops_without_stopping_serve(true);
}

#[test]
fn stdin_error_stops_the_reader_without_stopping_serve() {
    reader_stops_without_stopping_serve(false);
}

#[test]
fn releases_and_repeats_do_not_execute_shortcuts() {
    for (key, action) in [
        ('q', Shortcut::Close),
        ('c', Shortcut::Clear),
        ('o', Shortcut::Open),
        ('h', Shortcut::Help),
        ('r', Shortcut::Rebuild),
    ] {
        assert_eq!(
            shortcut(KeyEvent::new_with_kind(
                KeyCode::Char(key),
                KeyModifiers::NONE,
                KeyEventKind::Press
            )),
            Some(action)
        );
        for kind in [KeyEventKind::Release, KeyEventKind::Repeat] {
            assert_eq!(
                shortcut(KeyEvent::new_with_kind(
                    KeyCode::Char(key),
                    KeyModifiers::NONE,
                    kind
                )),
                None
            );
        }
    }
    assert_eq!(
        shortcut(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL)),
        Some(Shortcut::Close)
    );
    assert_eq!(
        shortcut(KeyEvent::new(KeyCode::Char('x'), KeyModifiers::NONE)),
        None
    );
}
