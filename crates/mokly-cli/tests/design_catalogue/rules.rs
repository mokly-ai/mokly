//! Link markers and hrefs, keyboard stops, and scripts.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::dom::{accessible_name, attribute, focus_stop, subtree, with_ancestors};
use super::expectations::strings;
use super::fixture::{Catalogue, route};

static EXTERNAL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(#|https?:|mailto:)").unwrap());
static HANDLER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^on").unwrap());
static SCRIPT_URL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^\s*javascript:").unwrap());

/// The published inspector script of the static build.
const INSPECTOR: &str = "/mokly-viewer/client/inspector.js";

/// The path of `to` relative to the folder `from`, with `/` separators.
fn relative(from: &str, to: &str) -> String {
    let from: Vec<&str> = from.split('/').filter(|part| !part.is_empty()).collect();
    let to: Vec<&str> = to.split('/').collect();
    let common = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
    let mut parts = vec![".."; from.len() - common];
    parts.extend(&to[common..]);
    parts.join("/")
}

/// Catalogue-wide link validation over every view.
pub(super) fn link_violations(catalogue: &Catalogue) -> Vec<String> {
    let visual: BTreeMap<&str, &Value> = catalogue
        .entries(&["screens", "components"])
        .into_iter()
        .map(|entry| (entry["path"].as_str().unwrap(), entry))
        .collect();
    let other: BTreeSet<&str> = catalogue
        .entries(&["pages", "documents", "useCases"])
        .into_iter()
        .map(|entry| entry["path"].as_str().unwrap())
        .collect();
    let mut violations = Vec::new();
    for view in &catalogue.views {
        for (element, ancestors) in with_ancestors(&view.document) {
            if element.name != "a" {
                if attribute(element, "data-mokly-link").is_some() {
                    violations.push(format!("{}: a {} link marker", view.route, element.name));
                }
                continue;
            }
            let href = attribute(element, "href");
            let place = format!("{}: \"{}\"", view.route, accessible_name(element));
            let Some(target) = attribute(element, "data-mokly-link") else {
                if href.is_some_and(|href| !EXTERNAL.is_match(href)) {
                    violations.push(format!("{place} has an unmarked href {}", href.unwrap()));
                }
                continue;
            };
            let (entry_path, fragment) = match target.split_once('#') {
                Some((path, fragment)) => (path, Some(fragment)),
                None => (target, None),
            };
            let entry = visual.get(entry_path);
            if entry.is_none() && !other.contains(entry_path) {
                violations.push(format!("{place} opens {target}, which is no entry"));
            }
            if view.path.starts_with("design/") && !entry_path.starts_with("design/") {
                violations.push(format!("{place} opens the example entry {target}"));
            }
            if let Some(entry) = entry {
                let dark =
                    view.scheme == "dark" && strings(entry, "colorSchemes").contains(&"dark");
                let scheme = if dark { "dark" } else { "light" };
                let folder = view.route.rsplit_once('/').map_or("", |(folder, _)| folder);
                let mut expected = relative(folder, &route(entry_path, &view.viewport, scheme));
                if let Some(fragment) = fragment {
                    expected.push_str(&format!("#{fragment}"));
                }
                if href != Some(expected.as_str()) {
                    violations.push(format!(
                        "{place} has href {}, not {expected}",
                        href.unwrap_or("undefined")
                    ));
                }
            }
            if ancestors.iter().any(|ancestor| focus_stop(ancestor)) {
                violations.push(format!("{place} sits inside another focus stop"));
            }
            for inner in subtree(element).into_iter().skip(1) {
                if focus_stop(inner) {
                    violations.push(format!("{place} holds a {} focus stop", inner.name));
                }
            }
            if attribute(element, "aria-disabled") == Some("true") {
                violations.push(format!("{place} is an inactive control"));
            }
            if entry_path == view.path
                && view.path.starts_with("design/")
                && attribute(element, "aria-current").is_none()
                && attribute(element, "class") != Some("mbk-brand")
            {
                violations.push(format!(
                    "{place} links to its own entry without aria-current"
                ));
            }
        }
    }
    violations
}

/// On design screens outside the component explorer, only the variant disclosure is an
/// enabled button, and only a link takes a tab stop.
pub(super) fn keyboard_stop_violations(catalogue: &Catalogue) -> Vec<String> {
    let mut violations = Vec::new();
    for view in catalogue.design_views() {
        if view.kind != "screen" || view.path.starts_with("design/components/") {
            continue;
        }
        for (element, _) in with_ancestors(&view.document) {
            let tabindex = attribute(element, "tabindex");
            if element.name == "button"
                && attribute(element, "disabled").is_none()
                && attribute(element, "class") != Some("mbk-nav-variants-toggle")
            {
                violations.push(format!(
                    "{}: button \"{}\"",
                    view.route,
                    accessible_name(element)
                ));
            } else if element.name != "a" && tabindex.is_some_and(|value| value != "-1") {
                violations.push(format!("{}: {} tabindex", view.route, element.name));
            }
        }
    }
    violations
}

/// Consumer scripts, inline handlers, and script URLs in any view document.
///
/// The published inspector, which the static build adds to the head, is no consumer script.
pub(super) fn script_violations(catalogue: &Catalogue) -> Vec<String> {
    let mut violations = Vec::new();
    for view in &catalogue.views {
        let mut inspectors = 0;
        for (element, ancestors) in with_ancestors(&view.document) {
            if element.name == "script" {
                let in_head = ancestors
                    .first()
                    .is_some_and(|parent| parent.name == "head");
                if in_head
                    && attribute(element, "src") == Some(INSPECTOR)
                    && element.children.is_empty()
                {
                    inspectors += 1;
                } else {
                    violations.push(format!("{}: script element", view.route));
                }
            }
            for attribute in &element.attributes {
                if HANDLER.is_match(&attribute.name) || SCRIPT_URL.is_match(&attribute.value) {
                    violations.push(format!(
                        "{}: {} {}",
                        view.route, element.name, attribute.name
                    ));
                }
            }
        }
        if inspectors > 1 {
            violations.push(format!("{}: {inspectors} inspector scripts", view.route));
        }
    }
    violations
}
