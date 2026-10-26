//! Static Changes compares a removed component parent and its variant.

use std::fs;

use mokly_test_support::changes;
use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use serde_json::json;

use super::support::{based, generation, json as read_json, mokly};

#[test]
fn static_changes_compares_a_removed_component_parent_and_its_variant() {
    let root = based(false);
    let path = root.path();
    write(
        path,
        "specs/card.component.html",
        "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: compact, title: Compact, props: {}}]\n---\n<p>Card</p>",
    );
    commit_all(path, "base component parent");
    git(path, &["branch", "fixture-base"]);
    fs::remove_file(path.join("specs/card.component.html")).unwrap();
    let built = changes::build(&mokly(), path, &[], "rich");
    assert_eq!(built.index["changesStatus"], "ready");
    let records = built.index["removedEntries"].as_array().unwrap();
    let paths: Vec<_> = records
        .iter()
        .map(|record| record["entry"]["path"].as_str().unwrap())
        .collect();
    assert_eq!(paths, ["card", "card/compact"]);
    let removed = json!({ "status": "ready", "kind": "removed", "eligible": true });
    let prefix = generation(&built.index);
    for record in records {
        let entry = &record["entry"];
        assert_eq!(entry["kind"], "component");
        assert_eq!(entry["comparison"], removed);
        for view in entry["views"].as_array().unwrap() {
            assert_eq!(view["comparison"], removed);
        }
        let detail = read_json(
            &built.output,
            &format!("{prefix}/entries/{}.json", entry["path"].as_str().unwrap()),
        );
        assert_eq!(detail["workspace"]["comparisonEligible"], true);
        assert_eq!(detail["reasons"], json!([{ "kind": "removed" }]));
        assert!(
            detail["views"]
                .as_array()
                .unwrap()
                .iter()
                .all(|view| view["usage"]["status"] == "ready")
        );
    }
}
