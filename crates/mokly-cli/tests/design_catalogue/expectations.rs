//! The frozen design inventory, the adoption table, link and tag expectations, and required components.

use std::fs;
use std::sync::LazyLock;

use mokly_test_support::workspace;
use regex::Regex;
use serde_json::Value;

fn fixture(name: &str) -> Value {
    let path = workspace::root().join(format!("tests/fixtures/design/{name}.json"));
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

/// The frozen design screens, runtime-only states, tree-reached screens, and retries.
pub(super) static INVENTORY: LazyLock<Value> = LazyLock::new(|| fixture("inventory"));

/// The adoption table: family patterns and the shared parts of each family.
pub(super) static ADOPTION: LazyLock<Value> = LazyLock::new(|| fixture("adoption"));

/// Saved variants by shared component, link expectations, and tag states.
pub(super) static EXPECTATIONS: LazyLock<Value> = LazyLock::new(|| fixture("expectations"));

/// Design entries that render in both schemes; every other one is light-only.
pub(super) static DUAL_SCHEME: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^design/(browse/(appearance|loading)/.+|browse/views/(screen|details-screen|screen/dark-scheme|screen/light-only)|changes/diff-controls/.+|changes/outcomes/(changed|difference)|library/chrome/(appearance-selector|top-bar)(/.+)?)$").unwrap()
});

/// The startup pages draw no catalogue chrome before the index arrives.
static STARTUP: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^design/browse/loading/(catalogue-loading|catalogue-failed|viewer-version)$")
        .unwrap()
});

/// Screens that depict no selected entry, so they have no screen header.
const UNSELECTED: [&str; 5] = [
    "design/browse/views/home",
    "design/browse/states/navigation",
    "design/browse/states/missing-route",
    "design/browse/appearance/status/home",
    "design/browse/appearance/workspaces/drawer",
];

/// Controls states that show no editable field.
const FIELDLESS: [&str; 6] = [
    "design/components/controls/limits/no-props",
    "design/components/controls/limits/read-only",
    "design/components/controls/limits/removed",
    "design/components/controls/published/readonly",
    "design/components/controls/published/readonly-variant",
    "design/components/controls/states/comparison",
];

/// The list `name` of a JSON object as strings, or none when it is absent.
pub(super) fn strings<'a>(value: &'a Value, name: &str) -> Vec<&'a str> {
    value[name]
        .as_array()
        .map(|items| items.iter().map(|item| item.as_str().unwrap()).collect())
        .unwrap_or_default()
}

/// Whether the adoption family `family` covers `path`.
fn in_family(family: &str, path: &str) -> bool {
    let pattern = ADOPTION["families"][family].as_str().unwrap();
    fancy_regex::Regex::new(pattern)
        .unwrap()
        .is_match(path)
        .unwrap()
}

/// The shared component ids that one design screen view must record.
pub(super) fn required_components(path: &str, viewport: &str) -> Vec<String> {
    if STARTUP.is_match(path) {
        return vec!["design/library/preview/empty-state".to_owned()];
    }
    let mut ids = vec!["chrome/top-bar", "chrome/appearance-selector"];
    if viewport == "desktop" {
        ids.push("chrome/catalogue-navigation");
    }
    if !UNSELECTED.contains(&path) {
        ids.push("chrome/screen-header");
    }
    if path.starts_with("design/browse/loading/") {
        ids.push("preview/empty-state");
    }
    if path.starts_with("design/changes/") {
        ids.extend(["inspector/inspector", "inspector/metadata-row"]);
    }
    if path.starts_with("design/components/") {
        ids.extend([
            "controls/view-controls",
            "controls/change-status",
            "inspector/inspector",
        ]);
    }
    if path.starts_with("design/components/controls/") && !FIELDLESS.contains(&path) {
        ids.push("inspector/prop-field");
    }
    if path == "design/browse/views/use-case" || path == "design/browse/appearance/status/flow" {
        ids.extend(["preview/flow-step", "preview/device-frame"]);
    }
    for part in ADOPTION["parts"].as_array().unwrap() {
        let applies = if part.get("only").is_some() {
            strings(part, "only").contains(&path)
        } else {
            in_family(part["family"].as_str().unwrap(), path)
                && !strings(part, "except").contains(&path)
        };
        if applies {
            ids.push(part["component"].as_str().unwrap());
        }
    }
    let mut unique: Vec<String> = Vec::new();
    for id in ids {
        let full = format!("design/library/{id}");
        if !unique.contains(&full) {
            unique.push(full);
        }
    }
    unique
}
