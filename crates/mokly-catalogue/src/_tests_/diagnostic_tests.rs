//! Warning subjects use JSON strings, including control and quote escaping.

use crate::diagnostic::{Warning, WarningSubject, normalize_warnings};

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

#[test]
fn build_warning_equal_printed_locations_keep_distinct_identities_and_stable_order() {
    let subject = Warning {
        code: "html-unused-props",
        subject: WarningSubject::Entry("home".into()),
        message: "unused".into(),
    };
    let route = Warning {
        subject: WarningSubject::Route(subject.printed_subject()),
        ..subject.clone()
    };
    let mut warnings = vec![
        subject.clone(),
        route.clone(),
        subject.clone(),
        route.clone(),
    ];
    normalize_warnings(&mut warnings);
    assert_eq!(warnings, vec![route, subject]);
}
