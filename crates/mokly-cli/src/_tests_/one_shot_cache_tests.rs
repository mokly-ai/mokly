//! Head-render cache notes wait for phase completion and never survive a failure.

use std::sync::{Arc, Mutex, mpsc};

use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_sidecar::workers::{Clock, ClockMock};
use unimock::{MockFn, Unimock, matching};

use crate::terminal::TerminalMock;

use super::{Lines, State};

fn lines(mode: Mode) -> (Lines, Arc<Mutex<Vec<String>>>) {
    let written = Arc::new(Mutex::new(Vec::new()));
    let capture = written.clone();
    let state = Arc::new(Mutex::new(State::default()));
    let observed = state.clone();
    let clock: Arc<dyn Clock> = if mode == Mode::Rich {
        Arc::new(Unimock::new(
            ClockMock::now_ms.each_call(matching!()).returns(1_000_u64),
        ))
    } else {
        Arc::new(Unimock::new(()))
    };
    let terminal = Arc::new(Unimock::new(
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                assert!(
                    observed.try_lock().is_err(),
                    "stdout must stay under the phase lock"
                );
                capture.lock().unwrap().push(text.to_owned());
            })),
    ));
    let (stop, _) = mpsc::channel();
    (
        Lines {
            clock,
            cwd: "/repo".into(),
            style: Style {
                mode,
                color: false,
                ascii: true,
                columns: 200,
            },
            redactor: Arc::new(Redactor::default()),
            terminal,
            state,
            stop,
            timer: Mutex::new(None),
            animate: mode == Mode::Rich,
        },
        written,
    )
}

#[test]
fn rendering_holds_the_cache_note_until_comparing_starts_even_in_plain_mode() {
    let (output, written) = lines(Mode::Plain);
    output.start(Phase::Rendering);
    output.note("Mokly cache: /cache/repository\n");
    assert!(written.lock().unwrap().is_empty());
    output.start(Phase::Comparing("base".into()));
    output.warnings(&[]);
    assert_eq!(
        written.lock().unwrap().join(""),
        "Mokly cache: /cache/repository\n"
    );
}

#[test]
fn empty_warnings_release_the_cache_note_once_without_settling_the_active_phase() {
    let (output, written) = lines(Mode::Rich);
    output.start(Phase::Rendering);
    written.lock().unwrap().clear();
    output.note("  cache /cache/repository\n");
    assert!(written.lock().unwrap().is_empty());
    output.warnings(&[]);
    output.warnings(&[]);
    assert_eq!(
        written.lock().unwrap().join(""),
        "\r\x1b[2K  cache /cache/repository\n"
    );
    assert_eq!(
        output.state.lock().unwrap().label.as_deref(),
        Some("Rendering catalogue")
    );
}

#[test]
fn dropping_during_rendering_discards_the_held_cache_note() {
    let (output, written) = lines(Mode::Rich);
    output.start(Phase::Rendering);
    written.lock().unwrap().clear();
    output.note("  cache /cache/repository\n");
    drop(output);
    assert_eq!(written.lock().unwrap().join(""), "\r\x1b[2K");
}
