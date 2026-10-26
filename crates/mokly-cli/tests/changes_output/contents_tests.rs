//! Static comparisons keep removed records, isolated sides, identities, and one output transaction.

use std::fs;

use mokly_test_support::changes;
use mokly_test_support::files::tree;
use mokly_test_support::identity;
use mokly_test_support::readers;
use mokly_test_support::timings::timings;
use serde_json::{Value, json};

use super::support::{current, generation, included, json as read_json, mokly, removed};

#[test]
fn static_comparisons_retain_removed_records_evidence_and_isolated_before_and_after_resources() {
    let fixture = changes::fixture();
    let root = fixture.root.path();
    let ready = changes::build(&mokly(), root, &[], "rich");
    let index = &ready.index;
    let comparison_url = index["comparisonUrl"].as_str().expect("a comparison URL");
    let prefix = generation(index);
    let name = prefix.rsplit('/').next().unwrap();
    let review = readers::review(&fs::read(ready.output.join(comparison_url)).unwrap());
    assert_eq!(review["schemaVersion"], 8);
    let mut changed: Vec<_> = current(index)
        .into_iter()
        .chain(removed(index))
        .filter(|entry| included(entry))
        .map(|entry| entry["path"].as_str().unwrap())
        .collect();
    changed.sort_unstable();
    assert_eq!(changed, ["home", "old", "old-note", "retired"]);
    assert_eq!(index["base"], "fixture-base");
    assert_eq!(review["baseCommit"], fixture.base.as_str());
    let output = tree(&ready.output);
    assert!(!output.contains_key(&format!("{prefix}/snapshot.json")));
    identity::check(
        &output,
        comparison_url,
        index["deploymentId"].as_str().unwrap(),
    );
    let text = |file: String| String::from_utf8_lossy(&output[&file]).into_owned();
    let side = |side: &str| format!("{prefix}/snapshots/{side}");
    assert!(
        text(format!(
            "{}/mokly-generated/home/index.desktop.html",
            side("before")
        ))
        .contains("Before")
    );
    assert!(
        text(format!(
            "{}/mokly-generated/home/index.desktop.html",
            side("after")
        ))
        .contains("After")
    );
    assert!(text(format!("{}/logo.svg", side("before"))).contains("Before asset"));
    assert!(text(format!("{}/logo.svg", side("after"))).contains("After asset"));
    let detail = read_json(&ready.output, "mokly-viewer/entries/home.json");
    assert_eq!(detail["deploymentId"], index["deploymentId"]);
    let reasons = review["entries"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["path"] == "home")
        .unwrap()["reasons"]
        .clone();
    assert_eq!(detail["reasons"], reasons);
    for view in detail["views"].as_array().unwrap() {
        assert!(
            view["resourceEvidence"]["resources"]
                .as_array()
                .unwrap()
                .iter()
                .any(|entry| entry["path"] == "static/logo.svg")
        );
    }
    let mut paths: Vec<_> = removed(index)
        .into_iter()
        .map(|entry| entry["path"].as_str().unwrap())
        .collect();
    paths.sort_unstable();
    assert_eq!(paths, ["old", "old-note", "retired"]);
    for record in index["removedEntries"].as_array().unwrap() {
        let path = record["entry"]["path"].as_str().unwrap();
        assert!(output.contains_key(&format!("view/{path}/index.html")));
        let historical = read_json(&ready.output, &format!("{prefix}/entries/{path}.json"));
        assert_eq!(historical["generation"], name);
        assert_eq!(historical["entry"]["snapshotId"], record["snapshotId"]);
        assert!(historical.get("deploymentId").is_none());
        assert!(historical.get("revision").is_none());
        assert_eq!(historical["reasons"], json!([{ "kind": "removed" }]));
        assert_eq!(record["preview"]["kind"], record["entry"]["kind"]);
        if record["entry"]["kind"] != "screen" {
            assert!(output.contains_key(&format!("{prefix}/previews/{path}/index.json")));
        }
    }
    fs::remove_dir_all(root.join("specs")).unwrap();
    fs::remove_file(root.join("logo.svg")).unwrap();
    assert_eq!(tree(&ready.output), output);
}

#[test]
fn build_review_timing_spans_descend_from_the_one_output_transaction_and_pin_the_base_once() {
    let fixture = changes::fixture();
    let result = mokly()
        .command(
            fixture.root.path(),
            &["build", "--out=.context/site", "--debug-timings"],
            "plain",
        )
        .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let records = timings(&result.stderr);
    let starts: Vec<&Value> = records
        .iter()
        .map(|record| &record.0)
        .filter(|record| record["event"] == "start")
        .collect();
    let count = |stage: &str| {
        starts
            .iter()
            .filter(|record| record["stage"] == stage)
            .count()
    };
    assert_eq!(count("output.write"), 1);
    assert_eq!(count("review.base-commit"), 1);
    let write = starts
        .iter()
        .find(|record| record["stage"] == "output.write")
        .unwrap()["id"]
        .clone();
    for stage in [
        "review.base-commit",
        "changes.classify",
        "review.base-tree",
        "review.compare-views",
        "review.resource-graph",
        "review.capture",
    ] {
        let spans: Vec<_> = starts
            .iter()
            .filter(|record| record["stage"] == stage)
            .collect();
        assert!(!spans.is_empty(), "{stage}");
        for span in spans {
            let mut parent = span["parentId"].clone();
            while parent.as_u64().is_some_and(|id| id != 0) && parent != write {
                parent = starts
                    .iter()
                    .find(|record| record["id"] == parent)
                    .map_or(Value::Null, |record| record["parentId"].clone());
            }
            assert_eq!(parent, write, "{stage}");
        }
    }
}
