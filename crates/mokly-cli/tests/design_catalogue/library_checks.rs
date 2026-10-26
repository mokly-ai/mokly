//! Recorded adoption and owner chains of library instances, the frozen screen baseline, and controls.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;

use mokly_test_support::workspace;
use serde_json::Value;

use super::expectations::{ADOPTION, EXPECTATIONS, required_components, strings};
use super::fixture::{Catalogue, route};

/// The usage instances of the library component `id`.
fn of<'a>(id: &str, instances: &'a [Value]) -> Vec<&'a Value> {
    let component = format!("design/library/{id}");
    instances
        .iter()
        .filter(|instance| instance["componentId"] == component.as_str())
        .collect()
}

/// A nested chip's owners are the tag picker and the top bar, and the flow's framed
/// steps stay in the caller's slots.
pub(super) fn owner_chain_violations(catalogue: &Catalogue) -> Vec<String> {
    let mut violations = Vec::new();
    let picker = "design/browse/views/screen/tag-picker";
    for (viewport, instances) in catalogue.usage(picker) {
        let Some(instances) = instances else {
            violations.push(format!("{picker}: {viewport} usage is not ready"));
            continue;
        };
        let by_key: BTreeMap<&str, &Value> = instances
            .iter()
            .map(|instance| (instance["key"].as_str().unwrap(), instance))
            .collect();
        let owner = |instance: Option<&Value>| {
            instance
                .filter(|instance| instance["owner"]["kind"] == "instance")
                .and_then(|instance| {
                    by_key
                        .get(instance["owner"]["instanceKey"].as_str().unwrap())
                        .copied()
                })
        };
        let chip = of("controls/tag-chip", instances)
            .into_iter()
            .find(|instance| instance["owner"]["kind"] == "instance");
        let parent = owner(chip);
        let chain = [parent, owner(parent)]
            .map(|instance| instance.and_then(|found| found["componentId"].as_str()));
        if chain
            != [
                Some("design/library/controls/tag-picker"),
                Some("design/library/chrome/top-bar"),
            ]
        {
            violations.push(format!("{picker}: {viewport} chip owners {chain:?}"));
        }
    }
    let flow = "design/browse/views/use-case";
    for (viewport, instances) in catalogue.usage(flow) {
        let Some(instances) = instances else {
            violations.push(format!("{flow}: {viewport} usage is not ready"));
            continue;
        };
        let mut steps: Vec<&str> = of("preview/flow-step", instances)
            .iter()
            .map(|step| step["id"].as_str().unwrap())
            .collect();
        steps.sort_unstable();
        if steps != ["arrival", "detail"] {
            violations.push(format!("{flow}: {viewport} steps {steps:?}"));
        }
        let frames = of("preview/device-frame", instances);
        let keys: BTreeSet<&str> = frames
            .iter()
            .map(|frame| frame["key"].as_str().unwrap())
            .collect();
        if frames.len() != 2 || keys.len() != 2 {
            violations.push(format!(
                "{flow}: {viewport} has {} frames with {} keys",
                frames.len(),
                keys.len()
            ));
        }
        for frame in frames {
            let slot = frame["slotKey"].as_str().unwrap_or("");
            if frame["owner"]["kind"] != "entry" || slot.is_empty() {
                violations.push(format!(
                    "{flow}: {viewport} frame {} leaves the caller's slot",
                    frame["key"]
                ));
            }
        }
    }
    violations
}

/// The frozen screen baseline keeps 54 screens with light mobile and desktop views, and
/// every shared component page has controls.
pub(super) fn baseline_violations(catalogue: &Catalogue) -> Vec<String> {
    let path = workspace::root().join("tests/fixtures/design-library/screens.json");
    let baseline: Vec<Value> = serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
    let mut violations = Vec::new();
    if baseline.len() != 54 {
        violations.push(format!("the baseline lists {} screens", baseline.len()));
    }
    let screens = catalogue.entries(&["screens"]);
    for original in &baseline {
        let path = original["path"].as_str().unwrap();
        let Some(entry) = screens.iter().find(|entry| entry["path"] == path) else {
            violations.push(format!("{path} is missing"));
            continue;
        };
        let mut viewports: Vec<&str> = entry["views"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|view| view["colorScheme"] == "light")
            .map(|view| view["viewport"].as_str().unwrap())
            .collect();
        viewports.sort_unstable();
        if viewports != ["desktop", "mobile"] {
            violations.push(format!("{path} has light views {viewports:?}"));
        }
    }
    let components = catalogue.entries(&["components"]);
    for id in EXPECTATIONS["sharedComponents"].as_object().unwrap().keys() {
        let path = format!("design/library/{id}");
        let parent = components
            .iter()
            .find(|entry| entry["path"] == path.as_str());
        let controls = parent
            .and_then(|parent| parent["controls"].as_object())
            .map_or(0, serde_json::Map::len);
        if controls == 0 {
            violations.push(format!("{path} has no controls"));
        }
    }
    violations
}

/// Recorded usage of each design screen view against its family's shared components.
pub(super) fn adoption_violations(catalogue: &Catalogue) -> Vec<String> {
    let screens: BTreeSet<&str> = catalogue
        .entries(&["screens"])
        .into_iter()
        .map(|entry| entry["path"].as_str().unwrap())
        .collect();
    let mut violations = Vec::new();
    for part in ADOPTION["parts"].as_array().unwrap() {
        for path in strings(part, "except")
            .into_iter()
            .chain(strings(part, "only"))
        {
            if !screens.contains(path) {
                violations.push(format!(
                    "{} lists {path}, which is no screen",
                    part["component"].as_str().unwrap()
                ));
            }
        }
    }
    for path in screens.iter().filter(|path| path.starts_with("design/")) {
        let views = catalogue.details[*path]["views"].as_array().unwrap();
        for viewport in ["mobile", "desktop"] {
            if !views.iter().any(|view| view["viewport"] == viewport) {
                violations.push(format!("{path}: no {viewport} usage"));
            }
        }
        for view in views {
            let viewport = view["viewport"].as_str().unwrap();
            let place = route(path, viewport, view["colorScheme"].as_str().unwrap());
            if view["usage"]["status"] != "ready" {
                violations.push(format!(
                    "{place}: usage is {}",
                    view["usage"]["status"].as_str().unwrap_or("")
                ));
                continue;
            }
            let instances = view["usage"]["instances"].as_array().unwrap();
            let ids: BTreeSet<&str> = instances
                .iter()
                .map(|use_| use_["componentId"].as_str().unwrap())
                .collect();
            for id in required_components(path, viewport) {
                if !ids.contains(id.as_str()) {
                    violations.push(format!("{place}: no {id}"));
                }
            }
            let keys: BTreeSet<&str> = instances
                .iter()
                .map(|use_| use_["key"].as_str().unwrap())
                .collect();
            if keys.len() != instances.len() {
                violations.push(format!("{place}: repeated instance keys"));
            }
        }
    }
    violations
}
