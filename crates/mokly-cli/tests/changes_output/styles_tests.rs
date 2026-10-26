//! Static Changes keeps dark-only evidence and captures matched, excluded, and transitive styles.

use std::fs;

use mokly_test_support::changes::{self, screen};
use mokly_test_support::files::{tree, write};
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::publication::link_node_modules;
use mokly_test_support::readers;

use super::support::{based, entry, generation, json as read_json, mokly};

fn dark_source(dark: &str) -> String {
    format!(
        "import React from 'react'; import {{defineScreen}} from '@mokly/mokly'; export default defineScreen({{title:'Home',description:'',relatedDocs:[],props:{{}},colorSchemes:['light','dark'],render(_props,{{colorScheme}}){{return React.createElement('p',null,colorScheme==='dark'?'{dark}':'Light');}}}});"
    )
}

#[test]
fn static_changes_preserves_dark_only_render_evidence_without_changing_light_views() {
    let root = based(true);
    let path = root.path();
    write(
        path,
        "mokly.config.json",
        r#"{"review":{"base":"fixture-base"},"colorSchemes":["light","dark"]}"#,
    );
    write(path, "specs/home.mockup.ts", dark_source("Before"));
    commit_all(path, "base dark views");
    git(path, &["branch", "fixture-base"]);
    write(path, "specs/home.mockup.ts", dark_source("After"));
    let built = changes::build(&mokly(), path, &[], "rich");
    let home = entry(&built.index, "screens", "home");
    assert_eq!(home["changes"]["status"], "ready");
    for view in home["views"].as_array().unwrap() {
        let dark = view["colorScheme"] == "dark";
        assert_eq!(view["comparison"]["status"], "ready");
        assert_eq!(
            view["comparison"]["kind"],
            if dark { "changed" } else { "unmodified" }
        );
        assert_eq!(view["comparison"]["eligible"], dark);
    }
    let output = tree(&built.output);
    changes::build(&mokly(), path, &[], "rich");
    assert_eq!(tree(&built.output), output);
}

#[test]
fn static_comparison_captures_matched_and_excluded_css_plus_transitive_resource_edits() {
    let root = based(false);
    let path = root.path();
    link_node_modules(path);
    write(
        path,
        "mokly.config.json",
        r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
    );
    write(
        path,
        "specs/home.screen.html",
        screen(r#"<p class="matched">Home</p>"#, ""),
    );
    write(path, "specs/empty.screen.html", screen("<p>Empty</p>", ""));
    write(
        path,
        "theme.css",
        r#"@import "./child.css"; .unused{color:red} .matched{color:red}"#,
    );
    write(
        path,
        "child.css",
        r#".matched{background:url("./asset.svg")}"#,
    );
    let svg = |title: &str| {
        format!(r#"<svg xmlns="http://www.w3.org/2000/svg"><title>{title}</title></svg>"#)
    };
    write(path, "asset.svg", svg("Before"));
    commit_all(path, "base styles");
    git(path, &["branch", "fixture-base"]);
    write(
        path,
        "theme.css",
        r#"@import "./child.css"; .unused{color:blue} .matched{color:blue}"#,
    );
    write(path, "asset.svg", svg("After"));
    let built = changes::build(&mokly(), path, &[], "rich");
    let detail = read_json(&built.output, "mokly-viewer/entries/home.json");
    for view in detail["views"].as_array().unwrap() {
        let evidence = &view["resourceEvidence"];
        assert!(
            evidence["rules"]
                .as_array()
                .unwrap()
                .iter()
                .any(|rule| rule["status"] == "matched")
        );
        assert!(!evidence["resources"].as_array().unwrap().is_empty());
    }
    let excluded = read_json(&built.output, "mokly-viewer/entries/empty.json");
    assert!(excluded["views"].as_array().unwrap().iter().all(|view| {
        view["resourceEvidence"]["rules"]
            .as_array()
            .unwrap()
            .iter()
            .any(|rule| rule["status"] == "excluded" && rule["selector"] == "")
    }));
    let comparison_url = built.index["comparisonUrl"].as_str().unwrap();
    let review = readers::review(&fs::read(built.output.join(comparison_url)).unwrap());
    let home = review["entries"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["path"] == "home")
        .unwrap();
    assert_eq!(home["state"], "changed");
    let prefix = generation(&built.index);
    let output = tree(&built.output);
    for (side, title) in [("before", "Before"), ("after", "After")] {
        let asset = output
            .iter()
            .find(|(file, _)| {
                file.starts_with(&format!("{prefix}/snapshots/{side}/"))
                    && file.ends_with("asset.svg")
            })
            .expect("the side's asset");
        assert!(String::from_utf8_lossy(asset.1).contains(title));
    }
}
