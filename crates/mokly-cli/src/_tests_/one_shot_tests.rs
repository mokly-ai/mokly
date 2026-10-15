//! Progress formatting uses captured durations and complete erase prefixes.

use crate::terminal::TerminalMock;
use mokly_cli::redaction::Redactor;
use mokly_publish::accounting::{Progress, Receipt};
use mokly_publish::completion::{Completion, Outcome};
use mokly_publish::runtime::Reporter;
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;
use unimock::{MockFn, Unimock, matching};

use mokly_cli::output::{Mode, Style};

use super::{duration, frame};

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
