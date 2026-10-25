//! Serve layouts keep columns, colors, duration units, and plain output exact.

use std::collections::BTreeMap;
use std::time::Duration;

use mokly_model::axes::EntryKind;

use crate::build::{BuildChanges, BuildSummary};
use crate::output::{Mode, Style};
use crate::redaction::Redactor;
use crate::serve_output::{
    ReadyPanel, accept_failure, accept_recovery, catalogue, changes_ready, changes_unavailable,
    ready, shortcuts,
};
use crate::version::VERSION;

/// Fixed input for exact layouts; the live header names `VERSION` instead.
const FIXED_VERSION: &str = "0.15.0";

#[test]
fn ready_layouts_and_shortcuts_follow_the_terminal_contract() {
    let mut layouts = Vec::new();
    for (mode, color, ascii, columns, watching, interactive) in [
        (Mode::Plain, false, false, 80, true, false),
        (Mode::Plain, false, false, 80, false, false),
        (Mode::Rich, false, false, 80, true, true),
        (Mode::Rich, true, false, 80, false, false),
        (Mode::Rich, false, true, 32, true, false),
    ] {
        let text = ReadyPanel {
            version: FIXED_VERSION,
            url: "http://127.0.0.1:4173",
            config: "examples/basic/mokly.config.json",
            base: "origin/main",
            watching,
            interactive,
        }
        .render(
            &Style {
                mode,
                color,
                ascii,
                columns,
            },
            &Redactor::default(),
        );
        if !color && mode == Mode::Rich {
            assert!(
                text.lines()
                    .all(|line| unicode_width::UnicodeWidthStr::width(line) <= columns)
            );
            let borders: Vec<_> = text
                .lines()
                .filter(|line| line.contains(if ascii { '|' } else { '│' }))
                .collect();
            assert!(borders[0].ends_with(if ascii { '|' } else { '│' }));
        }
        layouts.push(format!("{mode:?} {color} {ascii} {columns}:\n{text:?}"));
    }
    insta::assert_snapshot!("ready_layouts", layouts.join("\n\n"));
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 80,
    };
    let live = ready(
        &style,
        "http://127.0.0.1:4173",
        "examples/basic/mokly.config.json",
        "origin/main",
        true,
        true,
        &Redactor::default(),
    );
    assert!(live.starts_with(&format!("  mokly {VERSION} ")), "{live}");
    insta::assert_snapshot!("shortcuts", shortcuts(&style));
    insta::assert_snapshot!(
        "shortcuts_narrow",
        shortcuts(&Style {
            columns: 20,
            ..style
        })
    );
}

#[test]
fn ready_durations_and_unavailable_reason_have_bounded_styled_rows() {
    let summary = BuildSummary {
        changes: BuildChanges::Disabled,
        documents: 0,
        counts: BTreeMap::from([
            (EntryKind::Screen, 96),
            (EntryKind::Page, 12),
            (EntryKind::Component, 18),
        ]),
        warnings: vec![],
        deferred_modules: vec![],
    };
    let mut rows = Vec::new();
    for (color, ascii, columns) in [(false, false, 100), (true, false, 100), (false, true, 40)] {
        let style = Style {
            mode: Mode::Rich,
            color,
            ascii,
            columns,
        };
        for milliseconds in [312, 4900, 123_000] {
            let text = catalogue(&style, &summary, Duration::from_millis(milliseconds));
            rows.push(format!("{text:?}"));
        }
        rows.push(format!(
            "{:?}",
            changes_unavailable(
                &style,
                "Git comparison is unavailable in this build.",
                &Redactor::default()
            )
        ));
    }
    insta::assert_snapshot!("ready_completion_rows", rows.join("\n"));
    let plain = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 80,
    };
    assert!(catalogue(&plain, &summary, Duration::ZERO).is_empty());
    assert!(changes_unavailable(&plain, "reason", &Redactor::default()).is_empty());
}

#[test]
fn accept_failure_and_recovery_are_visible_in_both_modes() {
    for mode in [Mode::Plain, Mode::Rich] {
        let style = Style {
            mode,
            color: false,
            ascii: false,
            columns: 120,
        };
        assert_eq!(
            accept_failure(&style, "too many open files", &Redactor::default()).trim(),
            "! Serve cannot accept connections: too many open files. Retrying."
        );
        assert_eq!(
            accept_recovery(&style).trim(),
            "! Serve can accept connections again."
        );
    }
}

#[test]
fn changes_ready_uses_the_shared_counts_and_a_separate_duration_column() {
    let rich = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 90,
    };
    let line = changes_ready(&rich, 5, 1, 2, Duration::from_millis(3600));
    assert!(line.starts_with("  ✔ Changes ready · 5 changes · 1 moved · 2 ignored-only"));
    assert!(line.ends_with("3.6s\n"));
    assert_eq!(unicode_width::UnicodeWidthStr::width(line.trim_end()), 90);
    assert!(
        changes_ready(
            &Style {
                mode: Mode::Plain,
                ..rich
            },
            5,
            1,
            2,
            Duration::ZERO
        )
        .is_empty()
    );
}
