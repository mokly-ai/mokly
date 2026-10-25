//! Inner diagnostic tags are omitted only when the outer code is the same.

use std::path::Path;

use mokly_catalogue::diagnostic::{self, Issue, Warning, WarningSubject};
use mokly_catalogue::error::CatalogueError;

use crate::build::BuildError;
use crate::build_output::{failure, warnings};
use crate::output::{Mode, Style};
use crate::redaction::Redactor;

#[test]
fn configuration_tags_survive_inside_build_failures() {
    for mode in [Mode::Plain, Mode::Rich] {
        let style = Style {
            mode,
            color: false,
            ascii: false,
            columns: 200,
        };
        let issue = || {
            Issue::new(
                diagnostic::Code::ConfigInvalid,
                "invalid inventoried source bad",
            )
        };
        let build = BuildError::Catalogue {
            source: CatalogueError::Invalid {
                issues: vec![issue()],
                warnings: Vec::new(),
            },
        };
        let text = failure(&style, &build, &Redactor::default(), Path::new("/repo"));
        assert!(text.contains("[mokly/build-invalid]"), "{text}");
        assert!(
            text.contains("[mokly/config-invalid] invalid inventoried source bad"),
            "{text}"
        );
        let config = BuildError::Catalogue {
            source: CatalogueError::Config(issue()),
        };
        let text = failure(&style, &config, &Redactor::default(), Path::new("/repo"));
        assert_eq!(text.matches("[mokly/config-invalid]").count(), 1, "{text}");
        if mode == Mode::Plain {
            assert_eq!(
                text,
                "[mokly/config-invalid] invalid inventoried source bad\n"
            );
        }
    }
}

#[test]
fn build_warning_subjects_escape_controls_and_redact_secrets_in_both_modes() {
    for mode in [Mode::Plain, Mode::Rich] {
        let style = Style {
            mode,
            color: false,
            ascii: false,
            columns: 200,
        };
        let redactor = Redactor::collect(&[], Some("secret-token"));
        for (subject, printed) in [
            (
                WarningSubject::Route("home/index.html".into()),
                "home/index.html",
            ),
            (WarningSubject::Entry("home".into()), "entry \"home\""),
            (
                WarningSubject::Component("ui/action".into()),
                "component \"ui/action\"",
            ),
            (WarningSubject::Folder(String::new()), "folder \"\""),
            (
                WarningSubject::Configuration("tools/mokly.json".into()),
                "configuration \"tools/mokly.json\"",
            ),
        ] {
            let text = warnings(
                &style,
                &[Warning {
                    code: "html-unused-props",
                    subject,
                    message: "ignored secret-token\n\u{1b}\u{85}".into(),
                }],
                &redactor,
            );
            let prefix = if mode == Mode::Plain {
                "[mokly/warning]"
            } else {
                "  !"
            };
            assert_eq!(
                text,
                format!("{prefix} {printed}: ignored [redacted]\\u000a\\u001b\\u0085\n")
            );
        }
    }
}

#[test]
fn build_warning_strict_failures_count_all_but_base_dependencies_in_both_numbers() {
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 80,
    };
    for (count, noun) in [(1, "warning"), (2, "warnings")] {
        let mut records: Vec<_> = (0..count)
            .map(|index| Warning {
                code: "html-unused-props",
                subject: WarningSubject::Entry(format!("entry-{index}")),
                message: "unused prop".into(),
            })
            .collect();
        records.push(Warning {
            code: "base-dependencies",
            subject: WarningSubject::Configuration("mokly.config.json".into()),
            message: "Base dependencies differ.".into(),
        });
        let text = failure(
            &style,
            &BuildError::Strict { warnings: records },
            &Redactor::default(),
            Path::new("/repo"),
        );
        assert_eq!(text.matches("[mokly/warning]").count(), count + 1);
        assert!(text.ends_with(&format!(
            "[mokly/build-invalid] {count} build {noun} with --strict\n"
        )));
    }
}

#[test]
fn stylesheet_extglob_warning_has_exact_plain_and_rich_terminal_text() {
    for (mode, prefix) in [(Mode::Plain, "[mokly/warning]"), (Mode::Rich, "  !")] {
        let style = Style {
            mode,
            color: false,
            ascii: false,
            columns: 240,
        };
        let warning = Warning {
            code: "stylesheet-extglob",
            subject: WarningSubject::Configuration("tools/mokly.json".into()),
            message: "stylesheet match \"@(a|b)\" uses unsupported extglob syntax. Use brace alternatives such as \"{a,b}\" instead.".into(),
        };
        assert_eq!(
            warnings(&style, &[warning], &Redactor::default()),
            format!(
                "{prefix} configuration \"tools/mokly.json\": stylesheet match \"@(a|b)\" uses unsupported extglob syntax. Use brace alternatives such as \"{{a,b}}\" instead.\n"
            )
        );
    }
}
