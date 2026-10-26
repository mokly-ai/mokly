//! Base dependency spans report the tier, a fallback, and a read-limit failure without paths.

use std::collections::HashMap;
use std::fs::{self, OpenOptions};

use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::publication::{self, link_node_modules, temporary_root};
use mokly_test_support::timings::timings;
use serde_json::Value;

use super::support::mokly;

const PAGE: &str = "import {definePage} from '@mokly/mokly'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>'<!doctype html><html><head></head><body>Page</body></html>'});";

const ALLOWED: [&str; 12] = [
    "schemaVersion",
    "session",
    "pid",
    "role",
    "stage",
    "event",
    "id",
    "parentId",
    "elapsedMs",
    "durationMs",
    "status",
    "tier",
];

fn core(stderr: &str) -> Vec<Value> {
    timings(stderr)
        .into_iter()
        .map(|record| record.0)
        .filter(|record| record["role"] == "core")
        .collect()
}

#[test]
fn base_dependency_timings_report_working_fallback_and_failure_without_paths() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let cache = tempfile::Builder::new()
        .prefix("mokly-timing-cache-")
        .tempdir_in(temporary_root())
        .unwrap();
    link_node_modules(path);
    write(path, "specs/page.mockup.ts", PAGE);
    commit_all(path, "dependency timing base");
    git(path, &["branch", "timing-base"]);
    for tier in [Some(1), Some(3), None] {
        if tier == Some(3) {
            write(path, "package.json", r#"{"name":"changed-input"}"#);
        }
        let location = if tier.is_none() {
            path.join(".context/cache")
        } else {
            cache.path().to_path_buf()
        };
        let result = mokly()
            .command(
                path,
                &[
                    "build",
                    "--out=.context/site",
                    "--base=timing-base",
                    "--debug-timings",
                ],
                "plain",
            )
            .env("XDG_CACHE_HOME", &location)
            .env("LOCALAPPDATA", &location)
            .env("HOME", &location)
            .run();
        assert_eq!(
            result.code,
            Some(if tier.is_none() { 1 } else { 0 }),
            "{}",
            result.stderr
        );
        let all = core(&result.stderr);
        let records: Vec<_> = all
            .iter()
            .filter(|record| record["stage"] == "review.base-dependencies")
            .collect();
        let Some(tier) = tier else {
            assert!(records.is_empty());
            let tree = all
                .iter()
                .find(|record| record["stage"] == "review.base-tree" && record["event"] == "end")
                .unwrap();
            assert_eq!(tree["status"], "error");
            continue;
        };
        let events: Vec<_> = records
            .iter()
            .map(|record| record["event"].as_str().unwrap())
            .collect();
        assert_eq!(events, ["start", "end"]);
        assert_eq!(records[1]["tier"], tier);
        assert_eq!(records[1]["status"], "ok");
        let starts: HashMap<_, _> = all
            .iter()
            .filter(|record| record["event"] == "start")
            .map(|record| (record["id"].as_u64().unwrap(), record))
            .collect();
        let mut ancestors = Vec::new();
        let mut parent = records[0]["parentId"].as_u64();
        while let Some(id) = parent {
            let record = starts[&id];
            ancestors.push(record["stage"].as_str().unwrap());
            parent = record["parentId"].as_u64();
        }
        assert!(ancestors.contains(&"review.base-tree"));
        assert!(ancestors.contains(&"output.write"));
        for record in &records {
            let extra: Vec<_> = record
                .as_object()
                .unwrap()
                .keys()
                .filter(|key| !ALLOWED.contains(&key.as_str()))
                .collect();
            assert!(extra.is_empty(), "{extra:?}");
        }
    }
}

#[test]
fn a_dependency_input_over_its_read_limit_ends_the_leased_dependency_span_with_error() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let cache = tempfile::Builder::new()
        .prefix("mokly-timing-cache-")
        .tempdir_in(temporary_root())
        .unwrap();
    link_node_modules(path);
    write(path, "specs/page.mockup.ts", PAGE);
    commit_all(path, "dependency input base");
    OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path.join("yarn.lock"))
        .unwrap()
        .set_len(64 * 1024 * 1024 + 1)
        .unwrap();
    let result = mokly()
        .command(
            path,
            &[
                "build",
                "--out=.context/site",
                "--base=HEAD",
                "--debug-timings",
            ],
            "plain",
        )
        .env("XDG_CACHE_HOME", cache.path())
        .env("LOCALAPPDATA", cache.path())
        .env("HOME", cache.path())
        .run();
    let all = core(&result.stderr);
    let records: Vec<_> = all
        .iter()
        .filter(|record| record["stage"] == "review.base-dependencies")
        .collect();
    let events: Vec<_> = records
        .iter()
        .map(|record| record["event"].as_str().unwrap())
        .collect();
    assert_eq!(events, ["start", "end"]);
    assert_eq!(records[1]["status"], "error");
    assert_eq!(records[1]["id"], records[0]["id"]);
    assert!(records[1].get("tier").is_none());
    let text = records
        .iter()
        .map(|record| record.to_string())
        .collect::<String>();
    assert!(!text.contains(&path.display().to_string()));
    let parent = all
        .iter()
        .find(|record| record["event"] == "start" && record["id"] == records[0]["parentId"])
        .unwrap();
    assert_eq!(parent["stage"], "review.base-tree");
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert!(result.stderr.contains("source bytes exceed 67108864 bytes"));
    let _ = fs::remove_file(path.join("yarn.lock"));
}
