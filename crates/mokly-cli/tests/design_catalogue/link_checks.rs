//! The destinations of each control family, and the Welcome tag states.

use mokly_html::tree::Element;
use regex::Regex;
use serde_json::{Value, json};

use super::dom::{accessible_name, attribute, classes, text, with_ancestors};
use super::expectations::{EXPECTATIONS, strings};
use super::fixture::{Catalogue, View};

fn by_class<'a>(view: &'a View, name: &str) -> Vec<&'a Element> {
    with_ancestors(&view.document)
        .into_iter()
        .map(|(element, _)| element)
        .filter(|element| classes(element).contains(&name))
        .collect()
}

/// The semantic destinations of each control family, in every listed view.
pub(super) fn expectation_violations(catalogue: &Catalogue) -> Vec<String> {
    let mut violations = Vec::new();
    for expectation in EXPECTATIONS["links"].as_array().unwrap() {
        let source = expectation["source"].as_str().unwrap();
        let name = expectation["name"].as_str();
        let pattern = Regex::new(expectation["namePattern"].as_str().unwrap_or("^$")).unwrap();
        let matches = |text: &str| name.map_or_else(|| pattern.is_match(text), |name| text == name);
        let viewports = if expectation.get("viewports").is_some() {
            strings(expectation, "viewports")
        } else {
            vec!["mobile", "desktop"]
        };
        let within = expectation["within"].as_str();
        let views: Vec<&View> = catalogue
            .views
            .iter()
            .filter(|view| view.path == source && viewports.contains(&view.viewport.as_str()))
            .collect();
        if views.is_empty() {
            violations.push(format!("{source}: no view"));
        }
        for view in views {
            if let Some(within) = within
                && by_class(view, within).is_empty()
            {
                violations.push(format!("{}: no {within} container", view.route));
            }
            let found: Vec<&Element> = with_ancestors(&view.document)
                .into_iter()
                .filter(|(element, ancestors)| {
                    element.name == "a"
                        && within.is_none_or(|within| {
                            ancestors.iter().any(|node| classes(node).contains(&within))
                        })
                })
                .map(|(element, _)| element)
                .filter(|element| matches(&accessible_name(element)))
                .collect();
            let shown = name.or(expectation["namePattern"].as_str()).unwrap_or("");
            let targets: Vec<Option<&str>> = found
                .iter()
                .map(|link| attribute(link, "data-mokly-link"))
                .collect();
            let wrong = match expectation["target"].as_str() {
                None => !found.is_empty(),
                Some(target) => {
                    found.is_empty() || targets.iter().any(|found| *found != Some(target))
                }
            };
            if wrong {
                let listed: Vec<&str> = targets.iter().map(|target| target.unwrap_or("")).collect();
                violations.push(format!(
                    "{}: \"{shown}\" -> {}",
                    view.route,
                    listed.join(", ")
                ));
            }
        }
    }
    violations
}

/// The Welcome tag states agree on query, picker, chips, and rows.
pub(super) fn tag_violations(catalogue: &Catalogue) -> Vec<String> {
    let mut violations = Vec::new();
    for state in EXPECTATIONS["tagStates"].as_array().unwrap() {
        let path = state["path"].as_str().unwrap();
        let active_tags = strings(state, "active");
        for view in catalogue.views.iter().filter(|view| view.path == path) {
            let mut facts = |label: &str, actual: Value, expected: Value| {
                if actual != expected {
                    violations.push(format!("{}: {label} {actual}", view.route));
                }
            };
            let query: String = by_class(view, "mbk-search-value")
                .iter()
                .map(|node| text(&node.children))
                .collect();
            facts("query", json!(query), state["query"].clone());
            facts(
                "picker",
                json!(!by_class(view, "mbk-tag-picker").is_empty()),
                state["picker"].clone(),
            );
            let toggles: Vec<Option<&str>> = by_class(view, "mbk-search-tag")
                .iter()
                .map(|node| attribute(node, "data-mokly-link"))
                .collect();
            facts("toggle", json!(toggles), json!([state["toggle"]]));
            let chips: Vec<&Element> = by_class(view, "mbk-chip")
                .into_iter()
                .filter(|node| classes(node).contains(&"tag"))
                .collect();
            for chip in &chips {
                let tag = text(&chip.children).trim().to_owned();
                let active = classes(chip).contains(&"active");
                facts(
                    &format!("chip {tag} active"),
                    json!(active),
                    json!(active_tags.contains(&tag.as_str())),
                );
                let target = if active {
                    "design/browse/views/screen".to_owned()
                } else {
                    format!("design/browse/views/screen/tag-{tag}")
                };
                facts(
                    &format!("chip {tag} target"),
                    json!(attribute(chip, "data-mokly-link")),
                    json!(target),
                );
            }
            if chips.is_empty() {
                violations.push(format!("{}: no tag chips", view.route));
            }
            if state.get("rows").is_some() && view.viewport == "desktop" {
                let rows: Vec<String> = by_class(view, "mbk-nav-row")
                    .into_iter()
                    .filter(|node| node.name == "a")
                    .map(accessible_name)
                    .collect();
                let mut facts = |label: &str, actual: Value, expected: Value| {
                    if actual != expected {
                        violations.push(format!("{}: {label} {actual}", view.route));
                    }
                };
                facts("rows", json!(rows), state["rows"].clone());
            }
        }
    }
    violations
}
