//! Static Changes classifies ignored-only, moved, and removed entries, and caller props.

use std::fs;

use mokly_test_support::changes::{self, screen};
use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};

use super::support::{based, entry, generation, json, mokly};

const CARD: &str = "---\ntitle: Historical Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: compact, title: Compact, props: {}}]\n---\n<p>Card</p>";
const PAGE: &str = "---\ntitle: Page\n---\n<!doctype html><html><head></head><body><p>Page content</p></body></html>";

#[test]
fn static_changes_keeps_zero_ignored_only_moved_and_removed_variant_classifications() {
    let root = based(false);
    let path = root.path();
    write(
        path,
        "specs/ignored.screen.html",
        screen(
            r#"<h1>Kept</h1><mokly-ignore id="clock">Before</mokly-ignore>"#,
            "",
        ),
    );
    write(path, "specs/card.component.html", CARD);
    write(path, "specs/page.page.html", PAGE);
    commit_all(path, "base catalogue");
    git(path, &["branch", "fixture-base"]);
    let zero = changes::build(&mokly(), path, &[], "rich");
    assert!(zero.finished.stdout.contains("Changes ready · 0 changes"));
    let screens = zero.index["screens"].as_array().unwrap();
    assert!(screens.iter().all(|entry| {
        entry["changes"]["status"] == "ready" && entry["changes"]["included"] != true
    }));
    assert!(screens.iter().all(|entry| {
        entry["views"].as_array().unwrap().iter().all(|view| {
            view["comparison"]["status"] == "ready" && view["comparison"]["eligible"] != true
        })
    }));
    write(
        path,
        "specs/ignored.screen.html",
        screen(
            r#"<h1>Kept</h1><mokly-ignore id="clock">After</mokly-ignore>"#,
            "",
        ),
    );
    write(path, "unused.txt", "not rendered");
    let ignored = changes::build(&mokly(), path, &[], "rich");
    assert!(
        ignored
            .finished
            .stdout
            .contains("0 changes · 1 ignored-only")
    );
    write(
        path,
        "specs/moved.screen.html",
        screen("<h1>Home</h1>", "movedFrom: home\n"),
    );
    fs::remove_file(path.join("specs/home.screen.html")).unwrap();
    write(
        path,
        "specs/new-page.page.html",
        "---\ntitle: Page\nmovedFrom: page\n---\n<!doctype html><html><head></head><body><p>Page content</p></body></html>",
    );
    fs::remove_file(path.join("specs/page.page.html")).unwrap();
    write(
        path,
        "specs/card.component.html",
        "---\ntitle: Historical Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<p>Card</p>",
    );
    let moved = changes::build(&mokly(), path, &[], "rich");
    let index = &moved.index;
    assert_eq!(entry(index, "screens", "moved")["previousPath"], "home");
    assert_eq!(entry(index, "pages", "new-page")["previousPath"], "page");
    let records = index["removedEntries"].as_array().unwrap();
    let paths: Vec<_> = records
        .iter()
        .map(|record| record["entry"]["path"].as_str().unwrap())
        .collect();
    assert_eq!(paths, ["card/compact"]);
    let removed = &records[0];
    assert_eq!(removed["parentTitle"], "Historical Card");
    assert!(removed.get("preview").is_none());
    let comparison = &removed["entry"]["comparison"];
    assert!(comparison["status"] == "ready" && comparison["eligible"] == true);
    for name in ["home", "page"] {
        assert!(
            !moved
                .output
                .join(format!("view/{name}/index.html"))
                .exists()
        );
    }
    let historical = json(
        &moved.output,
        &format!("{}/entries/card/compact.json", generation(index)),
    );
    assert_eq!(historical["entry"]["snapshotId"], removed["snapshotId"]);
    assert!(
        historical["views"]
            .as_array()
            .unwrap()
            .iter()
            .all(|view| view["usage"]["status"] == "ready" && view["resourceEvidence"].is_object())
    );
}

fn button(body: &str) -> String {
    format!(
        "---\ntitle: Button\nelement: ui-button\npropSchema: {{type: object, additionalProperties: false, required: [label], properties: {{label: {{type: string}}}}}}\nprops: {{label: Own}}\n---\n<button>{body} {{{{label}}}}</button>"
    )
}

#[test]
fn static_detail_workspaces_preserve_component_impact_and_changed_caller_props() {
    let root = based(false);
    let path = root.path();
    write(path, "specs/button.component.html", button("Before"));
    write(
        path,
        "specs/home.screen.html",
        screen(r#"<ui-button mokly-instance="button" label="Old" />"#, ""),
    );
    write(
        path,
        "specs/affected.screen.html",
        screen(r#"<ui-button mokly-instance="button" label="Same" />"#, ""),
    );
    commit_all(path, "base components");
    git(path, &["branch", "fixture-base"]);
    write(path, "specs/button.component.html", button("After"));
    write(
        path,
        "specs/home.screen.html",
        screen(r#"<ui-button mokly-instance="button" label="New" />"#, ""),
    );
    let built = changes::build(&mokly(), path, &[], "rich");
    let uses = |detail: &serde_json::Value, list: &str, field: &str, value: &str| {
        detail["workspace"][list]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item[field] == value)
    };
    let button = json(&built.output, "mokly-viewer/entries/button.json");
    assert!(uses(&button, "usedBy", "entryPath", "home"));
    assert!(uses(&button, "affected", "entryPath", "affected"));
    let affected = json(&built.output, "mokly-viewer/entries/affected.json");
    assert!(uses(&affected, "relatedComponents", "path", "button"));
    assert_eq!(affected["workspace"]["comparisonEligible"], true);
    let home = json(&built.output, "mokly-viewer/entries/home.json");
    assert!(uses(&home, "inputChanges", "instanceId", "button"));
}
