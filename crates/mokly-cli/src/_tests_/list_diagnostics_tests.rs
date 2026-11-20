//! Authored controls stay escaped through catalogue preparation and both terminal printers.

use mokly_catalogue::diagnostic::Code;
use mokly_catalogue::error::CatalogueError;
use mokly_compare::error::Error;

use crate::build::BuildError;
use crate::build_output::failure_diagnostics;
use crate::output::{Mode, Style};
use crate::redaction::Redactor;
use crate::{changes_diagnostics, changes_output};

#[path = "list_diagnostics_support.rs"]
mod support;

#[test]
fn authored_list_controls_keep_head_and_base_location_lines() {
    let source = support::native_error();
    let CatalogueError::Invalid { issues, warnings } = &source else {
        panic!("expected a catalogue validation failure: {source:?}");
    };
    assert!(warnings.is_empty());
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].code, Code::DuplicatePath);
    let native_lines = [
        "[mokly/duplicate-path] path home is defined twice:",
        "  specs/\\u000afirst\\u0009\\u001b\\u0085Ω.md",
        "  specs/[second.md",
    ];
    let sidecar_issues = support::sidecar_issues();
    assert_eq!(sidecar_issues.len(), 1);
    assert_eq!(sidecar_issues[0].code, Code::DuplicateExport);
    assert!(sidecar_issues[0].message_has_location);
    assert_eq!(
        sidecar_issues[0].location.as_ref().unwrap().path,
        "specs/[second\n.mockup.ts"
    );
    let sidecar_lines = [
        "[mokly/duplicate-export] definition First\\u000a  Second\\u0009\\u001b\\u0085Ω\\u000a is exported by two entry modules:",
        "  specs/\\u000afirst\\u0009\\u001b\\u0085Ω.mockup.ts export page",
        "  specs/[second\\u000a.mockup.ts export page",
    ];
    for (source, lines) in [
        (source, native_lines),
        (
            CatalogueError::Invalid {
                issues: sidecar_issues,
                warnings: vec![],
            },
            sidecar_lines,
        ),
    ] {
        let error = BuildError::Catalogue { source };
        for mode in [Mode::Plain, Mode::Rich] {
            let style = Style {
                mode,
                color: false,
                ascii: false,
                columns: 240,
            };
            let expected = match mode {
                Mode::Plain => format!(
                    "[mokly/build-invalid] {}\n{}\n{}\n",
                    lines[0], lines[1], lines[2]
                ),
                Mode::Rich => format!(
                    "✖ The catalogue could not be built.  [mokly/build-invalid]\n  {}\n  {}\n  {}\n  Fix the reported catalogue source and retry.\n",
                    lines[0], lines[1], lines[2]
                ),
            };
            assert_eq!(
                failure_diagnostics(&style, &error, &Redactor::default()),
                expected,
                "head {mode:?}"
            );
        }
        let BuildError::Catalogue { source } = error else {
            unreachable!();
        };
        let base = Error::Base {
            commit: "0123456789012345678901234567890123456789".into(),
            scripts_off: false,
            source: Box::new(Error::Catalogue { source }),
        };
        let changes = changes_diagnostics::unavailable(&base, "origin/main").unwrap();
        for (mode, indent) in [(Mode::Plain, ""), (Mode::Rich, "  ")] {
            let style = Style {
                mode,
                color: false,
                ascii: false,
                columns: 240,
            };
            assert_eq!(
                changes_output::diagnostics(&style, &changes, &Redactor::default()),
                format!(
                    "{indent}base 0123456789012345678901234567890123456789: [mokly/build-invalid] {}\n{indent}{}\n{indent}{}\n",
                    lines[0], lines[1], lines[2]
                ),
                "base {mode:?}"
            );
        }
    }
}
