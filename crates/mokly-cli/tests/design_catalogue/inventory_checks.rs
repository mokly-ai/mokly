//! The design inventory, the shared library, and reachability.

use std::collections::{BTreeMap, BTreeSet};

use serde_json::Value;

use super::dom::{attribute, with_ancestors};
use super::expectations::{DUAL_SCHEME, EXPECTATIONS, INVENTORY, strings};
use super::fixture::Catalogue;

const LIBRARY: &str = "design/library/";
const VIEWPORTS: [&str; 2] = ["mobile", "desktop"];

fn path(entry: &Value) -> &str {
    entry["path"].as_str().unwrap()
}

/// The design screens equal the frozen inventory, and every design entry renders both
/// viewports in each scheme it lists: light-only, apart from the dual-scheme set.
pub(super) fn inventory_violations(catalogue: &Catalogue) -> Vec<String> {
    let mut screens: Vec<_> = catalogue
        .entries(&["screens"])
        .into_iter()
        .map(path)
        .filter(|screen| screen.starts_with("design/"))
        .collect();
    screens.sort_unstable();
    let frozen = strings(&INVENTORY, "screens");
    let mut violations: Vec<String> = screens
        .iter()
        .filter(|screen| !frozen.contains(screen))
        .map(|screen| format!("{screen} is not in the frozen inventory"))
        .collect();
    violations.extend(
        frozen
            .iter()
            .filter(|screen| !screens.contains(screen))
            .map(|screen| format!("{screen} is missing")),
    );
    for entry in catalogue.design_entries() {
        let schemes = if DUAL_SCHEME.is_match(path(entry)) {
            vec!["light", "dark"]
        } else {
            vec!["light"]
        };
        let listed = strings(entry, "colorSchemes");
        if listed != schemes {
            violations.push(format!("{} renders {}", path(entry), listed.join("+")));
        }
        let views: Vec<String> = entry["views"]
            .as_array()
            .unwrap()
            .iter()
            .map(|view| {
                format!(
                    "{}.{}",
                    view["viewport"].as_str().unwrap(),
                    view["colorScheme"].as_str().unwrap()
                )
            })
            .collect();
        for viewport in VIEWPORTS {
            for scheme in &listed {
                if !views.contains(&format!("{viewport}.{scheme}")) {
                    violations.push(format!("{} has no {viewport} {scheme} view", path(entry)));
                }
            }
        }
    }
    violations
}

fn consumed(catalogue: &Catalogue, component: &str, viewport: &str) -> bool {
    catalogue.entries(&["screens"]).into_iter().any(|screen| {
        path(screen).starts_with("design/")
            && catalogue
                .usage(path(screen))
                .into_iter()
                .any(|(view, instances)| {
                    view == viewport
                        && instances.is_some_and(|items| {
                            items.iter().any(|item| item["componentId"] == component)
                        })
                })
    })
}

/// Every shared component has its page, exactly its saved variants in order, and a real
/// design-screen consumer in each viewport.
pub(super) fn library_violations(catalogue: &Catalogue) -> Vec<String> {
    let components = catalogue.entries(&["components"]);
    let shared = EXPECTATIONS["sharedComponents"].as_object().unwrap();
    let parents: Vec<&Value> = components
        .iter()
        .copied()
        .filter(|entry| path(entry).starts_with(LIBRARY) && entry.get("variantOf").is_none())
        .collect();
    let mut violations: Vec<String> = parents
        .iter()
        .filter(|entry| !shared.contains_key(&path(entry)[LIBRARY.len()..]))
        .map(|entry| format!("{} is not an inventory component", path(entry)))
        .collect();
    for (id, variants) in shared {
        let parent = format!("{LIBRARY}{id}");
        if !parents.iter().any(|entry| path(entry) == parent) {
            violations.push(format!("{parent} has no page"));
            continue;
        }
        let saved: Vec<&str> = components
            .iter()
            .filter(|entry| entry["variantOf"] == parent.as_str())
            .map(|entry| &path(entry)[parent.len() + 1..])
            .collect();
        let expected: Vec<&str> = variants
            .as_array()
            .unwrap()
            .iter()
            .map(|item| item.as_str().unwrap())
            .collect();
        if saved != expected {
            violations.push(format!("{parent} saves {}", saved.join(", ")));
        }
        for viewport in VIEWPORTS {
            if !consumed(catalogue, &parent, viewport) {
                violations.push(format!("{parent} has no {viewport} screen consumer"));
            }
        }
    }
    violations
}

fn tree_entries(nodes: &[Value], found: &mut BTreeSet<String>) {
    for node in nodes {
        if node["kind"] == "entry" {
            found.insert(path(node).to_owned());
        }
        if let Some(children) = node["children"].as_array() {
            tree_entries(children, found);
        }
    }
}

/// Each design screen has an inbound design link, or the catalogue tree reaches it.
pub(super) fn reachability_violations(catalogue: &Catalogue) -> Vec<String> {
    let screens: Vec<&str> = catalogue
        .entries(&["screens"])
        .into_iter()
        .map(path)
        .filter(|screen| screen.starts_with("design/"))
        .collect();
    let mut sources: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for view in catalogue.design_views() {
        for (element, _) in with_ancestors(&view.document) {
            if element.name != "a" {
                continue;
            }
            let target =
                attribute(element, "data-mokly-link").map(|link| link.split('#').next().unwrap());
            if let Some(target) = target.filter(|target| !target.is_empty() && *target != view.path)
            {
                sources
                    .entry(target.to_owned())
                    .or_default()
                    .insert(view.path.clone());
            }
        }
    }
    let runtime_only = strings(&INVENTORY, "runtimeOnly");
    let tree_reached = strings(&INVENTORY, "treeReached");
    let retries = INVENTORY["retries"].as_object().unwrap();
    let mut listed: BTreeSet<&str> = runtime_only.iter().chain(&tree_reached).copied().collect();
    for (state, failures) in retries {
        listed.insert(state);
        listed.extend(
            failures
                .as_array()
                .unwrap()
                .iter()
                .map(|failure| failure.as_str().unwrap()),
        );
    }
    let mut tree = BTreeSet::new();
    tree_entries(catalogue.index["tree"].as_array().unwrap(), &mut tree);
    let mut violations: Vec<String> = listed
        .iter()
        .filter(|screen| !screens.contains(screen))
        .map(|screen| format!("{screen} is listed but is no design screen"))
        .collect();
    for state in &runtime_only {
        let allowed = retries
            .get(*state)
            .map(|failures| strings_of(failures))
            .unwrap_or_default();
        for source in sources.get(*state).into_iter().flatten() {
            if !allowed.contains(&source.as_str()) {
                violations.push(format!("{source} links to the runtime-only {state}"));
            }
        }
    }
    for screen in &screens {
        if !sources.contains_key(*screen)
            && !runtime_only.contains(screen)
            && !tree_reached.contains(screen)
        {
            violations.push(format!("{screen} has no inbound design link"));
        }
        if !tree.contains(*screen) {
            violations.push(format!("{screen} is not in the catalogue tree"));
        }
    }
    violations
}

fn strings_of(value: &Value) -> Vec<&str> {
    value
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item.as_str().unwrap())
        .collect()
}
