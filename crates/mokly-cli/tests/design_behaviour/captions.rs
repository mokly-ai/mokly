//! Inspect every component design, pairing captions with independently exposed records.

use std::collections::BTreeSet;

use super::{catalogue, dom, records};

/// The Details sentence of each reason that a captioned record can carry. A
/// `dependency` reads only through the list of changed files.
const EVIDENCE: [(&str, &str); 4] = [
    (
        "dependency",
        "Changes to these files may affect this component:",
    ),
    (
        "implementation",
        "Rendered content changed where this component is used.",
    ),
    ("material", "Rendered content changed."),
    ("removed", "Removed on this branch."),
];

/// Pair each rendered comparison caption with its authored factual record.
pub(crate) fn check() {
    let fixture = catalogue::shared();
    let records = records::read(&fixture);
    let expected = records["captions"].as_object().unwrap();
    assert_eq!(expected.len(), 8);
    let paths: Vec<_> = fixture
        .generation
        .catalogue()
        .model
        .entries
        .iter()
        .filter(|entry| entry.metadata.path.starts_with("design/components/"))
        .map(|entry| entry.metadata.path.clone())
        .collect();
    assert_eq!(paths.len(), 51);
    let mut seen = BTreeSet::new();
    for path in paths {
        for artifact in fixture.views(&path) {
            let document = artifact.document.as_ref().unwrap();
            let captions = dom::class(&document.tree, "ce-caption");
            if captions.is_empty() {
                assert!(
                    !expected.contains_key(&path),
                    "missing comparison caption: {path}"
                );
                continue;
            }
            let record = expected
                .get(&path)
                .unwrap_or_else(|| panic!("unrecorded caption: {path}"));
            let variant = record["variant"].as_str().unwrap();
            let reasons: Vec<_> = record["reasons"]
                .as_array()
                .unwrap()
                .iter()
                .map(|reason| reason.as_str().unwrap())
                .collect();
            assert_eq!(captions.len(), 2, "both preview contexts: {path}");
            for actual in captions {
                assert_eq!(
                    dom::text(&actual.children),
                    caption(variant, &reasons),
                    "{path}"
                );
            }
            let details = dom::class(&document.tree, "ce-comparison-evidence");
            assert_eq!(details.len(), 1, "{path}");
            let text = dom::text(&details[0].children);
            assert!(
                reasons
                    .iter()
                    .all(|reason| EVIDENCE.iter().any(|(kind, _)| kind == reason)),
                "unsupported caption reasons {reasons:?}: {path}"
            );
            // Each recorded reason reads once, and no other reason reads at all.
            for (reason, sentence) in EVIDENCE {
                let shown = usize::from(reasons.contains(&reason));
                assert_eq!(text.matches(sentence).count(), shown, "{path}: {text}");
            }
            assert!(text.contains(variant), "{path}: {text}");
            if record["savedPropsUnchanged"] == true {
                assert!(text.contains("Unchanged"), "{path}");
            }
            seen.insert(path.clone());
        }
    }
    assert_eq!(seen, expected.keys().cloned().collect::<BTreeSet<_>>());
}

/// The view change a caption names. An `implementation` reason describes
/// actual-instance impact, so it never changes the caption.
fn caption(variant: &str, reasons: &[&str]) -> String {
    if reasons.contains(&"removed") {
        format!("{variant} variant removed")
    } else if reasons.contains(&"material") {
        format!("{variant} variant · Appearance changed")
    } else if reasons.contains(&"dependency") {
        format!("{variant} variant · Styles this variant uses changed")
    } else {
        panic!("no caption reason in {reasons:?}")
    }
}
