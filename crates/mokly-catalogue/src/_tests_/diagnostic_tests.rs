//! Warning subjects use JSON strings, including control and quote escaping.

use crate::diagnostic::{Warning, WarningSubject};

#[test]
fn all_named_warning_subjects_use_json_quoting() {
    let path = "tools/\t\u{1b}\".json";
    for (subject, kind) in [
        (WarningSubject::Entry(path.into()), "entry"),
        (WarningSubject::Component(path.into()), "component"),
        (WarningSubject::Folder(path.into()), "folder"),
        (WarningSubject::Configuration(path.into()), "configuration"),
    ] {
        let warning = Warning {
            code: "test",
            subject,
            message: String::new(),
        };
        assert_eq!(
            warning.printed_subject(),
            format!("{kind} \"tools/\\t\\u001b\\\".json\"")
        );
    }
}
