//! Static input changes belong to their caller and need the same component counterpart.

use mokly_test_support::changes::{self, screen};
use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use serde_json::json;

use super::support::{based, json as read_json, mokly};

fn parent(child: &str, label: &str) -> String {
    format!(
        "---\ntitle: Parent\nelement: ui-parent\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n<ui-{child} mokly-instance=\"nested\" label=\"{label}\" />"
    )
}

#[test]
fn static_input_changes_belong_to_their_caller_and_require_the_same_component_counterpart() {
    let root = based(false);
    let path = root.path();
    for name in ["child", "alternate"] {
        write(
            path,
            &format!("specs/{name}.component.html"),
            format!(
                "---\ntitle: {name}\nelement: ui-{name}\npropSchema: {{type: object, additionalProperties: false, required: [label], properties: {{label: {{type: string}}}}}}\nprops: {{label: Own}}\n---\n<p>{{{{label}}}}</p>"
            ),
        );
    }
    write(
        path,
        "specs/parent.component.html",
        parent("child", "Before"),
    );
    write(
        path,
        "specs/home.screen.html",
        screen(r#"<ui-parent mokly-instance="outer" />"#, ""),
    );
    commit_all(path, "base nested inputs");
    git(path, &["branch", "fixture-base"]);
    write(
        path,
        "specs/parent.component.html",
        parent("child", "After"),
    );
    let built = changes::build(&mokly(), path, &[], "rich");
    let home = read_json(&built.output, "mokly-viewer/entries/home.json");
    assert_eq!(home["workspace"]["inputChanges"], json!([]));
    let changed = read_json(&built.output, "mokly-viewer/entries/parent.json");
    assert!(
        changed["workspace"]["inputChanges"]
            .as_array()
            .unwrap()
            .iter()
            .any(|change| change["instanceId"] == "nested")
    );
    write(
        path,
        "specs/parent.component.html",
        parent("alternate", "Replacement"),
    );
    let built = changes::build(&mokly(), path, &[], "rich");
    let replaced = read_json(&built.output, "mokly-viewer/entries/parent.json");
    assert_eq!(replaced["workspace"]["inputChanges"], json!([]));
}
