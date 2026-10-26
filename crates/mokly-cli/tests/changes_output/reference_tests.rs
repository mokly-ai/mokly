//! Markdown and renderer head style edits enter static Changes with their evidence.

use std::fs;

use mokly_test_support::changes;
use mokly_test_support::files::{tree, write};
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::readers;
use serde_json::json;

use super::support::{based, current, generation, included, json as read_json, mokly};

#[test]
fn markdown_edits_enter_static_changes_without_a_synthetic_visual_review_entry() {
    let root = based(false);
    let path = root.path();
    write(path, "specs/note.md", "# Note\n\nBefore text\n");
    commit_all(path, "base document");
    git(path, &["branch", "fixture-base"]);
    write(path, "specs/note.md", "# Note\n\nAfter text\n");
    let built = changes::build(&mokly(), path, &[], "rich");
    assert_eq!(
        built.index["documents"][0]["changes"],
        json!({ "status": "ready", "kind": "changed", "included": true })
    );
    let prefix = generation(&built.index);
    let changed: Vec<_> = current(&built.index)
        .into_iter()
        .filter(|entry| included(entry))
        .map(|entry| entry["path"].as_str().unwrap())
        .collect();
    assert_eq!(changed, ["note"]);
    let comparison_url = built.index["comparisonUrl"].as_str().unwrap();
    let review = readers::review(&fs::read(built.output.join(comparison_url)).unwrap());
    assert!(
        !review["entries"]
            .as_array()
            .unwrap()
            .iter()
            .any(|entry| entry["path"] == "note")
    );
    let output = tree(&built.output);
    let page = |side: &str| {
        String::from_utf8_lossy(
            &output[&format!("{prefix}/snapshots/{side}/mokly-generated/note/index.html")],
        )
        .into_owned()
    };
    assert!(page("before").contains("Before text"));
    assert!(page("after").contains("After text"));
}

fn renderer(color: &str) -> String {
    format!(
        "import React from 'react'; export default ({{node}})=>React.createElement(React.Fragment,null,React.createElement('style',null,'.subject{{color:{color}}}'),node);"
    )
}

#[test]
fn renderer_head_style_edits_enter_static_comparison_rule_evidence() {
    let root = based(true);
    let path = root.path();
    write(
        path,
        "mokly.config.json",
        r#"{"review":{"base":"fixture-base"},"renderer":"renderer.ts"}"#,
    );
    write(
        path,
        "specs/home.mockup.ts",
        "import React from 'react'; import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Home',description:'',relatedDocs:[],props:{},render(){return React.createElement('p',{className:'subject'},'Home');}});",
    );
    write(path, "renderer.ts", renderer("red"));
    commit_all(path, "base renderer");
    git(path, &["branch", "fixture-base"]);
    write(path, "renderer.ts", renderer("blue"));
    let built = changes::build(&mokly(), path, &[], "rich");
    let detail = read_json(&built.output, "mokly-viewer/entries/home.json");
    for view in detail["views"].as_array().unwrap() {
        assert!(
            view["resourceEvidence"]["rules"]
                .as_array()
                .unwrap()
                .iter()
                .any(|rule| rule["status"] == "matched" && rule["owner"]["kind"] == "entry")
        );
    }
    let prefix = generation(&built.index);
    let output = tree(&built.output);
    let page = |side: &str| {
        output[&format!("{prefix}/snapshots/{side}/mokly-generated/home/index.desktop.html")]
            .clone()
    };
    let (before, after) = (page("before"), page("after"));
    assert_ne!(before, after);
    assert!(String::from_utf8_lossy(&before).contains(">Home</p>"));
    assert!(String::from_utf8_lossy(&after).contains(">Home</p>"));
}
