//! Independent caller edits share one head commit while the control screen stays unchanged.

use std::path::Path;

use mokly_model::review::EntryChangeReason;

use crate::changes_support::write;

use super::native::Session;
use super::{edit, matrix};

const CASES: [(&str, &str, &str); 7] = [
    ("query", "QUERY_BEFORE", "QUERY_AFTER"),
    ("title", "TITLE_BEFORE", "TITLE_AFTER"),
    (
        "target",
        "destination='design/browse/views/home'",
        "destination='design/browse/views/screen'",
    ),
    ("status", "status='unmodified'", "status='changed'"),
    ("value", "VALUE_BEFORE", "VALUE_AFTER"),
    (
        "slot",
        "SLOT_BEFORE",
        "<tagChip.Component moklyInstance='supplied-chip' {...tagChip.props} />",
    ),
    ("order", "['first','second']", "['second','first']"),
];

fn file(label: &str) -> String {
    format!("examples/basic/specs/attribution-{label}.mockup.tsx")
}

pub fn seed(root: &Path) {
    for (label, _, _) in CASES {
        write(root, &file(label), matrix::SCREEN);
    }
}

pub fn run(root: &Path, session: &Session) {
    let files: Vec<_> = CASES.iter().map(|(label, _, _)| file(label)).collect();
    let edits: Vec<_> = files
        .iter()
        .zip(CASES)
        .map(|(file, (_, before, after))| {
            assert!(matrix::SCREEN.contains(before));
            (file.as_str(), matrix::SCREEN.replace(before, after))
        })
        .collect();
    edit(root, session, "caller input matrix", &edits, &|result| {
        let expected: Vec<_> = CASES
            .iter()
            .map(|(label, _, _)| format!("attribution-{label}"))
            .collect();
        matrix::changed(result, &expected);
        matrix::no_resource_changes(result);
        assert!(result.review.affected.is_empty());
        for (label, _, _) in CASES {
            let path = format!("attribution-{label}");
            let entry = result
                .entries
                .iter()
                .find(|entry| entry.path == path)
                .unwrap();
            if label == "order" {
                assert!(entry.reasons.contains(&EntryChangeReason::Structure));
            }
            for view in &entry.documents {
                let before = result
                    .before
                    .render(view.before_route.as_ref().unwrap())
                    .unwrap();
                let after = result
                    .after
                    .render(view.after_route.as_ref().unwrap())
                    .unwrap();
                if label != "order" {
                    assert_ne!(before.bytes, after.bytes, "{label}");
                }
                let before_usage = &before.document.as_ref().unwrap().usage;
                let after_usage = &after.document.as_ref().unwrap().usage;
                if label == "value" {
                    assert_eq!(
                        before_usage, after_usage,
                        "plain slot text keeps the same instance identities"
                    );
                } else {
                    assert_ne!(before_usage, after_usage, "{label}");
                }
            }
        }
    });
}
