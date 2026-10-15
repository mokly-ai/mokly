//! Serve layouts keep columns, colors, duration units, and plain output exact.

use std::collections::BTreeMap;
use std::time::Duration;

use mokly_model::axes::EntryKind;

use crate::build::BuildSummary;
use crate::output::{Mode, Style};
use crate::redaction::Redactor;
use crate::serve_output::{catalogue, changes_unavailable, ready, shortcuts};

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
        let text = ready(
            &Style {
                mode,
                color,
                ascii,
                columns,
            },
            "http://127.0.0.1:4173",
            "examples/basic/mokly.config.json",
            "origin/main",
            watching,
            interactive,
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
