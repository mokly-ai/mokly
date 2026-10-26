//! Static terminal output and the index agree on ready, unavailable, and disabled Changes.

use std::fs;
use std::path::Path;

use mokly_test_support::changes::{self, screen};
use mokly_test_support::files::{tree, write};
use mokly_test_support::git::git;
use mokly_test_support::readers;
use regex::Regex;
use serde_json::json;

use super::support::{current, generation, included, json as read_json, mokly, removed};

#[test]
fn static_terminal_and_index_agree_for_ready_unavailable_and_disabled_changes() {
    let fixture = changes::fixture();
    let root = fixture.root.path();
    let ready = changes::build(&mokly(), root, &[], "rich");
    assert_eq!(ready.index["changesStatus"], "ready");
    assert_eq!(ready.index["base"], "fixture-base");
    let entries = current(&ready.index);
    let paths: Vec<_> = entries
        .iter()
        .map(|entry| entry["path"].as_str().unwrap().to_owned())
        .collect();
    for entry in &entries {
        let detail = read_json(
            &ready.output,
            &format!(
                "mokly-viewer/entries/{}.json",
                entry["path"].as_str().unwrap()
            ),
        );
        assert_eq!(detail.get("reasons").is_some(), included(entry));
    }
    let count = entries
        .iter()
        .copied()
        .chain(removed(&ready.index))
        .filter(|entry| included(entry))
        .count();
    let summary = Regex::new(&format!("Changes ready · {count} changes?")).unwrap();
    assert!(summary.is_match(&ready.finished.stdout));
    assert_eq!(
        ready
            .finished
            .stdout
            .matches("Comparing with fixture-base")
            .count(),
        1
    );
    let comparison_url = ready.index["comparisonUrl"].as_str().unwrap().to_owned();
    let review = readers::review(&fs::read(ready.output.join(&comparison_url)).unwrap());
    assert_eq!(review["baseCommit"], fixture.base.as_str());
    let first = tree(&ready.output);
    changes::build(&mokly(), root, &[], "rich");
    assert_eq!(tree(&ready.output), first);
    write(root, "broken.config.json", "{invalid");
    git(root, &["add", "broken.config.json"]);
    git(root, &["commit", "-qm", "broken historical config"]);
    git(root, &["branch", "broken-base"]);
    write(root, "broken.config.json", "{}");
    let unavailable = changes::build(
        &mokly(),
        root,
        &["--config=broken.config.json", "--base=broken-base"],
        "rich",
    );
    assert_eq!(unavailable.index["changesStatus"], "unavailable");
    assert_eq!(unavailable.index["base"], "broken-base");
    assert!(unavailable.index["comparisonUrl"].is_null());
    assert_eq!(unavailable.index["removedEntries"], json!([]));
    assert!(
        Regex::new("Changes unavailable · .+")
            .unwrap()
            .is_match(&unavailable.finished.stdout)
    );
    assert!(
        Regex::new("(?i)base .*config")
            .unwrap()
            .is_match(&unavailable.finished.stderr)
    );
    let no_reasons = |output: &Path| {
        for path in &paths {
            let detail = read_json(output, &format!("mokly-viewer/entries/{path}.json"));
            assert!(detail.get("reasons").is_none(), "{path}");
        }
    };
    no_reasons(&unavailable.output);
    assert!(
        !tree(&ready.output)
            .keys()
            .any(|name| name.contains("diffs/generations/"))
    );
    let disabled = changes::build(&mokly(), root, &["--no-changes"], "rich");
    assert_eq!(disabled.index["changesStatus"], "disabled");
    assert!(disabled.index.get("base").is_none());
    assert!(disabled.index["comparisonUrl"].is_null());
    assert_eq!(disabled.index["removedEntries"], json!([]));
    no_reasons(&disabled.output);
    let comparing = Regex::new("Changes ready|Changes unavailable|Comparing with").unwrap();
    assert!(!comparing.is_match(&disabled.finished.stdout));
    let restored = changes::build(&mokly(), root, &[], "rich");
    assert_eq!(restored.index["changesStatus"], "ready");
    assert_eq!(restored.index["comparisonUrl"], comparison_url.as_str());
}

#[test]
fn nested_static_invocations_discover_the_config_and_use_the_explicit_pinned_base() {
    let fixture = changes::fixture();
    let root = fixture.root.path();
    git(root, &["branch", "override-base", "fixture-base"]);
    let result = mokly()
        .command(
            &root.join("specs"),
            &["build", "--base=override-base", "--out=.context/nested"],
            "rich",
        )
        .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let output = root.join(".context/nested");
    let index = read_json(&output, "mokly-viewer/index.json");
    assert_eq!(index["base"], "override-base");
    assert_eq!(index["changesStatus"], "ready");
    assert!(result.stdout.contains("Comparing with override-base"));
    let review = read_json(&output, index["comparisonUrl"].as_str().unwrap());
    assert_eq!(review["baseCommit"], fixture.base.as_str());
}

#[test]
fn changes_enabled_builds_deliver_build_directory_entry_names_and_preserve_output_after_history_failure()
 {
    let fixture = changes::fixture();
    let root = fixture.root.path();
    let names = [
        "dist",
        "target",
        "build",
        "coverage",
        "mokly-static",
        "test-results",
        "playwright-report",
    ];
    for name in names {
        write(
            root,
            &format!("specs/{name}.screen.html"),
            screen(&format!("<h1>{name}</h1>"), ""),
        );
    }
    let ready = changes::build(&mokly(), root, &[], "rich");
    let output = tree(&ready.output);
    let prefix = generation(&ready.index);
    for name in names {
        for file in [
            format!("view/{name}/index.html"),
            format!("mokly-viewer/entries/{name}.json"),
            format!("static/mokly-generated/{name}/index.desktop.html"),
            format!("{prefix}/snapshots/after/mokly-generated/{name}/index.desktop.html"),
        ] {
            assert!(output.contains_key(&file), "{file}");
        }
        let entry = ready.index["screens"]
            .as_array()
            .unwrap()
            .iter()
            .find(|entry| entry["path"] == name)
            .unwrap();
        assert_eq!(entry["changes"]["kind"], "added");
    }
    let failed = mokly()
        .command(
            root,
            &["build", "--out=.context/site", "--base=missing-base"],
            "plain",
        )
        .run();
    assert_eq!(failed.code, Some(1));
    assert!(failed.stderr.contains("[mokly/git-failed]"));
    assert_eq!(tree(&ready.output), output);
}
