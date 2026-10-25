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

#[test]
fn failed_actions_print_warnings_before_indented_diagnostics() {
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 160,
    };
    let mut batch = Batch::default();
    batch.insert(
        Event {
            path: "/repo/specs/home.screen.html".into(),
            kind: Kind::File,
        },
        Action::Rebuild,
    );
    let text = crate::watch_output::failure(
        &style,
        &batch,
        Path::new("/repo"),
        "12:05:31",
        "warning: unused prop\n",
        "[mokly/build-invalid] missing import\n",
        &Redactor::default(),
    );
    assert_eq!(
        text,
        "warning: unused prop\n  12:05:31  ✖ specs/home.screen.html\n            [mokly/build-invalid] missing import\n            The last good catalogue is still being served.\n"
    );
    let plain = Style {
        mode: Mode::Plain,
        ..style
    };
    assert_eq!(
        crate::watch_output::failure(
            &plain,
            &batch,
            Path::new("/repo"),
            "12:05:31",
            "warning\n",
            "failure\n",
            &Redactor::default()
        ),
        "warning\nfailure\n"
    );
}

#[test]
fn git_refresh_uses_the_watch_clock_glyph_and_action() {
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 100,
    };
    assert_eq!(
        crate::watch_output::git_refresh(&style, "origin/main", "12:05:20", &Redactor::default()),
        "  12:05:20  ⟲ origin/main moved  comparing again\n"
    );
    assert_eq!(
        crate::watch_output::git_refresh(
            &Style {
                ascii: true,
                ..style.clone()
            },
            "base",
            "12:05:20",
            &Redactor::default()
        ),
        "  12:05:20  G base moved  comparing again\n"
    );
    assert!(
        crate::watch_output::git_refresh(
            &Style {
                mode: Mode::Plain,
                ..style
            },
            "base",
            "12:05:20",
            &Redactor::default()
        )
        .is_empty()
    );
}
