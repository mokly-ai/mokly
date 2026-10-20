//! Changes uses identical counts, omits zero segments, and preserves the plain contract.

use mokly_compare::comparison_types::ComparisonCounts;

use crate::changes_output::ready;
use crate::output::{Mode, Style};
use crate::redaction::Redactor;
use crate::{build::BuildChanges, changes_output, serve_output};

#[test]
fn counts_pluralize_and_zero_segments_are_absent() {
    let mut style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 200,
    };
    assert_eq!(
        ready(&style, ComparisonCounts::default()),
        "  ✔ Changes ready · 0 changes\n"
    );
    let counts = ComparisonCounts {
        changes: 1,
        moved: 1,
        ignored_only: 2,
    };
    assert_eq!(
        ready(&style, counts),
        "  ✔ Changes ready · 1 change · 1 moved · 2 ignored-only\n"
    );
    style.mode = Mode::Plain;
    assert_eq!(ready(&style, counts), "");
}

#[test]
fn rich_changes_glyphs_are_colored_and_plain_output_has_no_ansi() {
    let mut style = Style {
        mode: Mode::Rich,
        color: true,
        ascii: false,
        columns: 200,
    };
    assert!(ready(&style, ComparisonCounts::default()).contains("\x1b[32m✔\x1b[0m Changes ready"));
    let unavailable = crate::build::BuildChanges::Unavailable {
        base_ref: "fixture-base".into(),
        base_commit: "base".into(),
        reason: "base validation failed".into(),
        diagnostics: vec![],
    };
    let text = crate::changes_output::summary(
        &style,
        &unavailable,
        &crate::redaction::Redactor::default(),
    );
    assert!(text.contains("\x1b[33m!\x1b[0m Changes unavailable"));
    style.mode = Mode::Plain;
    assert_eq!(
        crate::changes_output::summary(
            &style,
            &unavailable,
            &crate::redaction::Redactor::default()
        ),
        ""
    );
}

#[test]
fn warning_formatting_preserves_existing_bytes_at_every_width() {
    let mut rows = Vec::new();
    for mode in [Mode::Plain, Mode::Rich] {
        for color in [false, true] {
            for columns in [1, 3, 4, 24, 120] {
                let style = Style {
                    mode,
                    color,
                    ascii: false,
                    columns,
                };
                let changes = BuildChanges::Unavailable {
                    base_ref: "base".into(),
                    base_commit: "base".into(),
                    reason: "base validation failed".into(),
                    diagnostics: vec![],
                };
                rows.push(format!(
                    "{mode:?}/{color}/{columns}: {:?} {:?} {:?} {:?}",
                    changes_output::summary(&style, &changes, &Redactor::default()),
                    serve_output::changes_unavailable(
                        &style,
                        "base validation failed",
                        &Redactor::default()
                    ),
                    serve_output::accept_failure(&style, "no descriptors", &Redactor::default()),
                    serve_output::accept_recovery(&style)
                ));
            }
        }
    }
    insta::assert_snapshot!(rows.join("\n"));
}
