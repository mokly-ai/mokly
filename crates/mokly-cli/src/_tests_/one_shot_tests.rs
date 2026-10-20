//! Progress formatting uses captured durations and complete erase prefixes.

use std::path::Path;
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use mokly_cli::output::{Mode, Style};
use mokly_cli::publication::command::BuildReporter;
use mokly_cli::redaction::Redactor;
use mokly_publish::accounting::{Progress, Receipt};
use mokly_publish::completion::{Completion, Outcome};
use mokly_publish::runtime::Reporter;
use unimock::{MockFn, Unimock, matching};

use crate::terminal::TerminalMock;

use super::{duration, frame};

#[test]
fn retained_publication_warning_clears_active_progress_before_printing() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let stdout = events.clone();
    let stderr = events.clone();
    let terminal = Arc::new(Unimock::new((
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                stdout.lock().unwrap().push(("stdout", text.to_owned()));
            })),
        TerminalMock::stderr
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                stderr.lock().unwrap().push(("stderr", text.to_owned()));
            })),
    )));
    let (stop, _) = mpsc::channel();
    let output = super::Lines {
        clock: Arc::new(Unimock::new(())),
        cwd: "/repo".into(),
        style: Style {
            mode: Mode::Rich,
            color: false,
            ascii: true,
            columns: 200,
        },
        redactor: Arc::new(Redactor::collect(&[], None)),
        terminal,
        state: Arc::new(Mutex::new(super::State {
            label: Some("Uploading catalogue".into()),
            ..Default::default()
        })),
        stop,
        timer: Mutex::new(None),
        animate: true,
    };
    output.retained_directory(Path::new("/private/site"));
    let recorded = events.lock().unwrap().clone();
    assert_eq!(recorded, vec![
        ("stdout", "\r\x1b[2K".into()),
        ("stderr", "[mokly/warning] Publication completed. The local build remains at /private/site. Remove it when you no longer need it.\n".into()),
    ]);
    assert!(output.state.lock().unwrap().label.is_none());
}

#[test]
fn durations_round_milliseconds_and_keep_minutes_and_seconds() {
    for (input, expected) in [
        (Duration::from_micros(1500), "2ms"),
        (Duration::from_millis(4900), "4.9s"),
        (Duration::from_secs(123), "2m 03s"),
    ] {
        assert_eq!(duration(input), expected);
    }
}
#[test]
fn every_frame_erases_the_previous_line_and_respects_width() {
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: true,
        columns: 24,
    };
    let text = frame(&style, "Writing static output with a very long label", 2);
    assert!(text.starts_with("\r\x1b[2K"));
    assert!(unicode_width::UnicodeWidthStr::width(&text[5..]) <= 24);
    insta::assert_snapshot!(text);
}

#[test]
fn an_empty_replan_restores_the_base_label_and_viewer_urls_are_redacted() {
    let lines = Arc::new(Mutex::new(Vec::new()));
    let written = lines.clone();
    let terminal = Arc::new(Unimock::new(
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                written.lock().unwrap().push(text.to_owned())
            })),
    ));
    let (stop, _) = mpsc::channel();
    let output = super::Lines {
        clock: Arc::new(Unimock::new(())),
        cwd: "/repo".into(),
        style: Style {
            mode: Mode::Rich,
            color: false,
            ascii: true,
            columns: 200,
        },
        redactor: Arc::new(Redactor::collect(&[], Some("private-token"))),
        terminal,
        state: Arc::new(Mutex::new(super::State::default())),
        stop,
        timer: Mutex::new(None),
        animate: true,
    };
    output.progress(&Progress {
        round: 0,
        completed: 1,
        total: 9,
        size: 100,
    });
    output.round(1);
    assert_eq!(
        output.state.lock().unwrap().label.as_deref(),
        Some("Uploading catalogue")
    );
    assert!(
        lines
            .lock()
            .unwrap()
            .last()
            .unwrap()
            .ends_with("Uploading catalogue")
    );
    output.published(
        &Receipt {
            uploaded: 1,
            unchanged: 8,
            completion: Completion {
                outcome: Outcome::Published,
                viewer_url: Some("https://example.com/private-token".into()),
            },
        },
        Duration::ZERO,
    );
    let written = lines.lock().unwrap().join("");
    assert!(!written.contains("private-token"));
    assert!(written.contains("https://example.com/[redacted]"));
}

#[test]
fn rich_publication_receipts_style_zero_one_two_counts_and_leave_urls_unstyled() {
    let written = Arc::new(Mutex::new(Vec::new()));
    let capture = written.clone();
    let terminal = Arc::new(Unimock::new(
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                capture.lock().unwrap().push(text.to_owned())
            })),
    ));
    let (stop, _) = mpsc::channel();
    let output = super::Lines {
        clock: Arc::new(Unimock::new(())),
        cwd: "/repo".into(),
        style: Style {
            mode: Mode::Rich,
            color: true,
            ascii: false,
            columns: 200,
        },
        redactor: Arc::new(Redactor::default()),
        terminal,
        state: Arc::new(Mutex::new(super::State::default())),
        stop,
        timer: Mutex::new(None),
        animate: false,
    };
    for count in 0..=2 {
        output.published(
            &Receipt {
                uploaded: count,
                unchanged: 9 - count,
                completion: Completion {
                    outcome: Outcome::Published,
                    viewer_url: Some("https://example.com/catalogue".into()),
                },
            },
            Duration::from_millis(1500),
        );
    }
    let text = written.lock().unwrap().join("");
    for line in text.lines().filter(|line| line.contains("https://")) {
        assert_eq!(line, "https://example.com/catalogue");
    }
    assert!(text.contains("0 files uploaded"));
    assert!(text.contains("1 file uploaded"));
    assert!(text.contains("2 files uploaded"));
    insta::assert_snapshot!(text);
}

#[test]
fn an_animated_cache_note_erases_under_the_reporter_lock_and_keeps_the_phase() {
    let written = Arc::new(Mutex::new(Vec::new()));
    let capture = written.clone();
    let state = Arc::new(Mutex::new(super::State {
        label: Some("Comparing with base".into()),
        ..Default::default()
    }));
    let observed = state.clone();
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
    let output = super::Lines {
        clock: Arc::new(Unimock::new(())),
        cwd: "/repo".into(),
        style: Style {
            mode: Mode::Rich,
            color: false,
            ascii: true,
            columns: 200,
        },
        redactor: Arc::new(Redactor::default()),
        terminal,
        state: state.clone(),
        stop,
        timer: Mutex::new(None),
        animate: true,
    };
    mokly_cli::static_build::Phases::note(&output, "  cache /cache/repository\n");
    assert_eq!(
        written.lock().unwrap().join(""),
        "\r\x1b[2K  cache /cache/repository\n"
    );
    assert_eq!(
        state.lock().unwrap().label.as_deref(),
        Some("Comparing with base")
    );
}
