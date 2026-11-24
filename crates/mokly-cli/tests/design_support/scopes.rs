//! Exact route scopes pin every shared stylesheet and all saved library variants.
//!
//! The library alone links the component sheets. The Canvas route links the
//! Canvas sheets, and the library links the preview, mini-screen and shared
//! Canvas sheets for its Canvas samples.

use std::collections::{BTreeMap, BTreeSet};

use mokly_compare::comparison_types::ComparisonResult;
use mokly_graph::urls::local_target;
use mokly_html::tree::Node;
use mokly_model::catalogue::EntryContent;

/// The shared sheets that the design routes link, in link order.
pub const SHEETS: [&str; 18] = [
    "design-preview.css",
    "design-shots.css",
    "design-canvas.css",
    "design-canvas-inspect.css",
    "design-canvas-sections.css",
    "design-canvas-changes.css",
    "design-canvas-outcomes.css",
    "design-canvas-flows.css",
    "design-canvas-loading.css",
    "design-canvas-search.css",
    "design-canvas-components.css",
    "design-canvas-props.css",
    "design-canvas-evidence.css",
    "design-canvas-shell.css",
    "design-canvas-compact.css",
    "design-components.css",
    "design-component-details.css",
    "design-library.css",
];

pub type Scopes = BTreeMap<String, Vec<String>>;

pub fn route(sheet: &str) -> String {
    format!("static/mokly-generated/styles/examples/basic/{sheet}")
}

pub fn check(result: &ComparisonResult) -> Scopes {
    let entries = &result.after.catalogue().model.entries;
    let components: Vec<_> = entries
        .iter()
        .filter(|entry| entry.metadata.path.starts_with("design/library/"))
        .collect();
    assert_eq!(
        components
            .iter()
            .filter(|entry| entry.metadata.variant_of.is_some())
            .count(),
        75
    );
    let screens: BTreeSet<_> = entries
        .iter()
        .filter(|entry| {
            matches!(entry.content, EntryContent::Screen { .. })
                && entry.metadata.path.starts_with("design/")
        })
        .map(|entry| entry.metadata.path.clone())
        .collect();
    let frozen: serde_json::Value = serde_json::from_str(include_str!(
        "../../../../tests/fixtures/design/inventory.json"
    ))
    .unwrap();
    let frozen: BTreeSet<_> = frozen["screens"]
        .as_array()
        .unwrap()
        .iter()
        .map(|path| path.as_str().unwrap().to_owned())
        .collect();
    assert_eq!(screens, frozen);
    let mut scopes = Scopes::new();
    for entry in entries {
        let path = &entry.metadata.path;
        let visual = matches!(
            entry.content,
            EntryContent::Screen { .. } | EntryContent::Component { .. }
        );
        let library = path.starts_with("design/library/");
        let canvas = screens.contains(path) && path.starts_with("design/canvas/");
        let sheets: Vec<_> = SHEETS
            .iter()
            .filter(|sheet| {
                visual
                    && match **sheet {
                        "design-components.css"
                        | "design-component-details.css"
                        | "design-library.css" => library,
                        "design-preview.css" | "design-shots.css" | "design-canvas.css" => {
                            library || canvas
                        }
                        _ => canvas,
                    }
            })
            .map(|sheet| (*sheet).to_owned())
            .collect();
        scopes.insert(path.clone(), sheets);
    }
    for plan in result.after.plans().values() {
        let path = &entries[plan.entry].metadata.path;
        let artifact = result.after.render(&plan.route).unwrap();
        let document = artifact.document.as_ref().unwrap();
        let mut pending: Vec<_> = document.tree.iter().rev().collect();
        let mut actual = Vec::new();
        while let Some(node) = pending.pop() {
            match node {
                Node::Element(element) => {
                    if element.name == "link" && element.get("rel") == Some("stylesheet") {
                        let target = local_target(
                            &format!("static/mokly-generated/{}", plan.route),
                            element.get("href").unwrap(),
                        )
                        .unwrap()
                        .unwrap();
                        if SHEETS
                            .iter()
                            .chain(["design.css"].iter())
                            .any(|sheet| target == route(sheet))
                        {
                            actual.push(target);
                        }
                    }
                    pending.extend(element.children.iter().rev());
                }
                Node::Region { children, .. } => pending.extend(children.iter().rev()),
                _ => {}
            }
        }
        let mut expected: Vec<_> = scopes[path].iter().map(|sheet| route(sheet)).collect();
        if !scopes[path].is_empty() {
            expected.insert(0, route("design.css"));
        }
        assert_eq!(actual, expected, "{}", plan.route);
    }
    scopes
}

pub fn own_props(result: &ComparisonResult) {
    for side in [&result.before, &result.after] {
        for (path, tag) in [
            ("design/library/controls/tag-chip", "span"),
            ("design/library/controls/tag-chip/default", "a"),
        ] {
            let index = side
                .catalogue()
                .model
                .entries
                .iter()
                .position(|entry| entry.metadata.path == path)
                .unwrap();
            for plan in side.plans().values().filter(|plan| plan.entry == index) {
                let artifact = side.render(&plan.route).unwrap();
                let mut pending: Vec<_> = artifact.document.as_ref().unwrap().tree.iter().collect();
                let mut tags = Vec::new();
                while let Some(node) = pending.pop() {
                    match node {
                        Node::Element(element) => {
                            if element.get("class").is_some_and(|class| {
                                class
                                    .split_ascii_whitespace()
                                    .any(|token| token == "mbk-chip")
                            }) {
                                tags.push(element.name.as_str());
                            }
                            pending.extend(&element.children);
                        }
                        Node::Region { children, .. } => pending.extend(children),
                        _ => {}
                    }
                }
                assert_eq!(tags, [tag], "{} must render its own props", plan.route);
            }
        }
    }
}
