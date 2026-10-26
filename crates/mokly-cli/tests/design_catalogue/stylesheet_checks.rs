//! The component stylesheets that each view links, and the route scopes of the shared sheets.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::dom::{attribute, with_ancestors};
use super::fixture::{Catalogue, View};

static SHEET_PREFIX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\.\./)*styles/examples/basic/").unwrap());

const BASE_SHEETS: [&str; 5] = [
    "design.css",
    "design-stage.css",
    "design-documents.css",
    "design-review.css",
    "design-review-scroll.css",
];

const LIBRARY: &str = "design/library/";

fn path(entry: &Value) -> &str {
    entry["path"].as_str().unwrap()
}

/// A view's stylesheet links, relative to the example folder.
pub(super) fn stylesheets(view: &View) -> Vec<String> {
    with_ancestors(&view.document)
        .into_iter()
        .filter(|(element, _)| {
            element.name == "link" && attribute(element, "rel") == Some("stylesheet")
        })
        .map(|(element, _)| {
            SHEET_PREFIX
                .replace(attribute(element, "href").unwrap(), "")
                .into_owned()
        })
        .collect()
}

/// Each design view links exactly the own stylesheets of the library components it renders,
/// as one block between the base and layout sheets.
pub(super) fn component_sheet_violations(catalogue: &Catalogue) -> Vec<String> {
    let mut violations = Vec::new();
    for view in catalogue.design_views() {
        let usage = catalogue.details[&view.path]["views"]
            .as_array()
            .unwrap()
            .iter()
            .find(|candidate| {
                candidate["viewport"] == view.viewport.as_str()
                    && candidate["colorScheme"] == view.scheme.as_str()
            })
            .unwrap()["usage"]
            .clone();
        let mut ids: BTreeSet<String> = if usage["status"] == "ready" {
            usage["instances"]
                .as_array()
                .unwrap()
                .iter()
                .map(|use_| use_["componentId"].as_str().unwrap().to_owned())
                .collect()
        } else {
            BTreeSet::new()
        };
        if view.kind == "component" {
            ids.insert(view.path.split('/').take(4).collect::<Vec<_>>().join("/"));
        }
        // Sort the file names, not the ids: "tag-chip.css" sorts before "tag.css".
        let mut expected: Vec<String> = ids
            .iter()
            .filter_map(|id| id.strip_prefix("design/library/"))
            .map(|id| format!("design-library/{id}.css"))
            .collect();
        expected.sort();
        let links = stylesheets(view);
        let mut own: Vec<&String> = links
            .iter()
            .filter(|sheet| sheet.starts_with("design-library/"))
            .collect();
        own.sort();
        let own_text: Vec<&str> = own.iter().map(|sheet| sheet.as_str()).collect();
        if own_text != expected {
            violations.push(format!(
                "{}: links {}; renders {}",
                view.route,
                own_text.join(", "),
                expected.join(", ")
            ));
        }
        let first = links
            .iter()
            .position(|sheet| sheet.starts_with("design-library/"));
        let last = links
            .iter()
            .rposition(|sheet| sheet.starts_with("design-library/"));
        if let (Some(first), Some(last)) = (first, last) {
            let between = &links[first..=last];
            let base = |sheet: &String| BASE_SHEETS.contains(&sheet.as_str());
            if between.len() != own.len()
                || links[last + 1..].iter().any(base)
                || links[..first].iter().any(|sheet| !base(sheet))
            {
                violations.push(format!("{}: component sheets out of place", view.route));
            }
        }
    }
    violations
}

/// The shared design sheets keep their route scopes.
pub(super) fn scope_violations(catalogue: &Catalogue) -> Vec<String> {
    let mut linked: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for view in catalogue.design_views() {
        for sheet in stylesheets(view) {
            if !sheet.starts_with("design-library/") {
                linked.entry(sheet).or_default().insert(view.path.clone());
            }
        }
    }
    let entries = catalogue.design_entries();
    let library: Vec<&str> = entries
        .iter()
        .map(|entry| path(entry))
        .filter(|path| path.starts_with(LIBRARY))
        .collect();
    let variants = entries
        .iter()
        .filter(|entry| path(entry).starts_with(LIBRARY) && entry.get("variantOf").is_some())
        .count();
    let screens = |pattern: &str| -> Vec<&str> {
        let pattern = Regex::new(pattern).unwrap();
        catalogue
            .entries(&["screens"])
            .into_iter()
            .map(path)
            .filter(|path| path.starts_with("design/") && pattern.is_match(path))
            .collect()
    };
    let scopes: [(&[&str], Vec<&str>); 4] = [
        (
            &[
                "design-components.css",
                "design-component-inspection.css",
                "design-component-details.css",
                "design-component-view.css",
            ],
            screens(r"^design/components/"),
        ),
        (
            &["design-component-controls.css"],
            screens(r"^design/components/controls/"),
        ),
        (&["design-library.css"], Vec::new()),
        (
            &[
                "design.css",
                "design-stage.css",
                "design-component-inspector.css",
                "design-component-workspace.css",
            ],
            screens(r"^design/"),
        ),
    ];
    let mut violations = if variants == 69 {
        Vec::new()
    } else {
        vec![format!("{variants} saved variants")]
    };
    for (sheets, scope) in &scopes {
        for sheet in *sheets {
            let expected: Vec<&str> = scope.iter().chain(&library).copied().collect();
            let actual: Vec<&str> = linked
                .get(*sheet)
                .into_iter()
                .flatten()
                .map(String::as_str)
                .collect();
            let extra: Vec<&str> = actual
                .iter()
                .filter(|entry| !expected.contains(entry))
                .copied()
                .collect();
            let missing: Vec<&str> = expected
                .iter()
                .filter(|entry| !actual.contains(entry))
                .copied()
                .collect();
            if !extra.is_empty() || !missing.is_empty() {
                violations.push(format!(
                    "{sheet}: {} extra ({}), {} missing ({})",
                    extra.len(),
                    extra.iter().take(3).copied().collect::<Vec<_>>().join(", "),
                    missing.len(),
                    missing
                        .iter()
                        .take(3)
                        .copied()
                        .collect::<Vec<_>>()
                        .join(", ")
                ));
            }
        }
    }
    let pins = [
        screens(r"^design/components/").len(),
        screens(r"^design/components/controls/").len(),
    ];
    if pins != [53, 20] {
        violations.push(format!("scopes pin {}, {}", pins[0], pins[1]));
    }
    violations
}
