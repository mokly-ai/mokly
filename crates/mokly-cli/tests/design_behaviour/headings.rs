//! Inspect every component design, pairing comparison headings with independently exposed records.

use std::collections::BTreeSet;

use mokly_html::tree::{Element, Node};

use super::{catalogue, dom, records};

/// The Details sentence of each reason that a recorded comparison can carry. A
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

/// Pair each rendered component comparison heading with its authored factual record.
pub(crate) fn check() {
    let fixture = catalogue::shared();
    let records = records::read(&fixture);
    let expected = records["headings"].as_object().unwrap();
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
    assert_eq!(paths.len(), 53);
    let mut seen = BTreeSet::new();
    for path in paths {
        for artifact in fixture.views(&path) {
            let document = artifact.document.as_ref().unwrap();
            let sections = component_sections(&document.tree);
            if sections.is_empty() {
                assert!(
                    !expected.contains_key(&path),
                    "missing comparison heading: {path}"
                );
                continue;
            }
            let record = expected
                .get(&path)
                .unwrap_or_else(|| panic!("unrecorded comparison heading: {path}"));
            let variant = record["variant"].as_str().unwrap();
            let reasons: Vec<_> = record["reasons"]
                .as_array()
                .unwrap()
                .iter()
                .map(|reason| reason.as_str().unwrap())
                .collect();
            assert_eq!(sections.len(), 2, "both preview contexts: {path}");
            for section in sections {
                let viewport = section.get("data-diff-viewport").unwrap();
                let headings: Vec<_> = dom::elements(&section.children)
                    .into_iter()
                    .filter(|element| element.name == "h3")
                    .collect();
                assert_eq!(headings.len(), 1, "one section heading: {path}");
                assert_eq!(
                    dom::text(&headings[0].children),
                    heading(viewport, &reasons),
                    "{path}"
                );
            }
            let details = dom::class(&document.tree, "mbk-comparison-evidence");
            assert_eq!(details.len(), 1, "{path}");
            let text = dom::text(&details[0].children);
            assert!(
                reasons
                    .iter()
                    .all(|reason| EVIDENCE.iter().any(|(kind, _)| kind == reason)),
                "unsupported recorded reasons {reasons:?}: {path}"
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

/// The viewport sections of a component's comparison. A screen's comparison,
/// such as an affected consumer's, carries no component mark.
fn component_sections(tree: &[Node]) -> Vec<&Element> {
    dom::class(tree, "mbk-diff-screen")
        .into_iter()
        .filter(|stage| stage.get("data-diff-component").is_some())
        .flat_map(|stage| dom::class(&stage.children, "mbk-diff-view"))
        .collect()
}

/// The heading a recorded change gives a section: its viewport, then the
/// variant's state, in the shell's words. An `implementation` reason describes
/// actual-instance impact, so it never changes the heading.
fn heading(viewport: &str, reasons: &[&str]) -> String {
    let viewport = match viewport {
        "mobile" => "Mobile",
        "desktop" => "Desktop",
        other => panic!("unknown section viewport {other}"),
    };
    let state = if reasons.contains(&"removed") {
        "Variant removed"
    } else if reasons.contains(&"material") {
        "Variant changed"
    } else if reasons.contains(&"dependency") {
        "Styles this variant uses changed"
    } else {
        panic!("no heading reason in {reasons:?}")
    };
    format!("{viewport} · {state}")
}
