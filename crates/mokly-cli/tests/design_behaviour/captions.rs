//! Inspect every component design, pairing captions with independently exposed records.

use std::collections::BTreeSet;

use serde_json::Value;

use super::{catalogue, dom};

/// Pair each rendered comparison caption with its authored factual record.
pub(crate) fn check() {
    let fixture = catalogue::shared();
    let records = fixture.views("behaviour-records");
    let record_tree = &records[0].document.as_ref().unwrap().tree;
    let pre = dom::elements(record_tree)
        .into_iter()
        .find(|element| element.get("id") == Some("records"))
        .unwrap();
    let records: Value = serde_json::from_str(&dom::text(&pre.children)).unwrap();
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
    assert_eq!(paths.len(), 50);
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
            let (caption, evidence) = match record["reason"].as_str().unwrap() {
                "output" => (
                    format!("{variant} variant · Appearance changed"),
                    "Rendered output changed",
                ),
                "styles" => (
                    format!("{variant} variant · Styles this variant uses changed"),
                    "Styles this variant uses changed",
                ),
                "variant-removed" => (
                    format!("{variant} variant removed"),
                    "Saved variant removed",
                ),
                reason => panic!("unsupported caption reason {reason}: {path}"),
            };
            assert_eq!(captions.len(), 2, "both preview contexts: {path}");
            for actual in captions {
                assert_eq!(dom::text(&actual.children), caption, "{path}");
            }
            let details = dom::class(&document.tree, "ce-comparison-evidence");
            assert_eq!(details.len(), 1, "{path}");
            let text = dom::text(&details[0].children);
            assert!(text.contains(evidence), "{path}: {text}");
            assert!(text.contains(variant), "{path}: {text}");
            if record["savedPropsUnchanged"] == true {
                assert!(text.contains("Unchanged"), "{path}");
            }
            seen.insert(path.clone());
        }
    }
    assert_eq!(seen, expected.keys().cloned().collect::<BTreeSet<_>>());
}
