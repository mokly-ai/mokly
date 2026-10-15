//! Watched terminal lines preserve plain compatibility and every burst path.

use std::path::Path;
use std::time::Duration;

use mokly_watch::event::{Action, Batch, Event, Kind};

use crate::output::{Mode, Style};
use crate::redaction::Redactor;
use crate::watch_output::line;

#[test]
fn strongest_action_names_three_paths_and_the_remaining_count() {
    let mut batch = Batch::default();
    for path in ["a.html", "b.css", "c.js", "d.txt", "mokly.config.json"] {
        batch.insert(
            Event {
                path: Path::new("/repo").join(path),
                kind: Kind::File,
            },
            Action::Config,
        );
    }
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 120,
    };
    let redactor = Redactor::default();
    let text = line(
        &style,
        &batch,
        Path::new("/repo"),
        "12:05:02",
        Duration::from_millis(1800),
        true,
        &redactor,
    );
    assert!(text.contains("12:05:02  ↺ a.html, b.css, c.js, +2 more  config reloaded"));
    assert!(text.ends_with("1.8s\n"));
    let plain = Style {
        mode: Mode::Plain,
        ..style.clone()
    };
    assert_eq!(
        line(
            &plain,
            &batch,
            Path::new("/repo"),
            "12:05:02",
            Duration::ZERO,
            true,
            &redactor
        ),
        ""
    );
    let failure = line(
        &style,
        &batch,
        Path::new("/repo"),
        "12:05:02",
        Duration::ZERO,
        false,
        &redactor,
    );
    assert!(failure.contains("✖ a.html, b.css, c.js, +2 more"));
    assert!(!failure.contains("reloaded"));
}
