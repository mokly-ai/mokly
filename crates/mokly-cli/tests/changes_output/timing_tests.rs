//! Changes timing spans: failed base preparation, final view counts, and base capture counts.

use std::fs;

use mokly_test_support::changes::{self, screen};
use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::publication;
use mokly_test_support::timings::{Timing, timings};
use serde_json::Value;

use super::support::mokly;

fn records<'a>(records: &'a [Timing], stage: &str) -> Vec<&'a Value> {
    records
        .iter()
        .map(|record| &record.0)
        .filter(|record| record["stage"] == stage)
        .collect()
}

fn events(records: &[&Value]) -> Vec<String> {
    records
        .iter()
        .map(|record| record["event"].as_str().unwrap().to_owned())
        .collect()
}

#[test]
fn a_failed_base_preparation_ends_its_timing_span_with_error_while_unavailable_changes_settles() {
    let fixture = changes::fixture();
    let root = fixture.root.path();
    write(root, "broken.config.json", "{invalid");
    git(root, &["add", "broken.config.json"]);
    git(root, &["commit", "-qm", "broken historical config"]);
    git(root, &["branch", "broken-base"]);
    write(root, "broken.config.json", "{}");
    let result = mokly()
        .command(
            root,
            &[
                "build",
                "--out=.context/site",
                "--config=broken.config.json",
                "--base=broken-base",
                "--debug-timings",
            ],
            "plain",
        )
        .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let all = timings(&result.stderr);
    let end = |stage: &str| {
        all.iter()
            .find(|record| record.event() == "end" && record.stage() == stage)
            .unwrap()
            .status()
            .map(str::to_owned)
    };
    assert_eq!(end("review.base-tree").as_deref(), Some("error"));
    assert_eq!(end("changes.classify").as_deref(), Some("ok"));
}

#[test]
fn changes_timings_count_final_view_states_without_a_changed_path_stage_or_source_data() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    write(
        path,
        "mokly.config.json",
        r#"{"review":{"base":"timing-base"}}"#,
    );
    write(path, "specs/kept.screen.html", screen("<p>Kept</p>", ""));
    write(
        path,
        "specs/retired.screen.html",
        screen("<p>Retired</p>", ""),
    );
    write(
        path,
        "specs/ignored.screen.html",
        screen(r#"<mokly-ignore id="clock">Before</mokly-ignore>"#, ""),
    );
    write(
        path,
        "specs/page.page.html",
        "---\ntitle: Page\n---\n<!doctype html><html><head></head><body>Page</body></html>",
    );
    commit_all(path, "timing base");
    git(path, &["branch", "timing-base"]);
    let allowed = [
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
        "views",
        "unchanged",
        "changed",
        "ignoredOnly",
    ];
    let root_text = path.to_string_lossy().into_owned();
    for change in [false, true] {
        if change {
            write(
                path,
                "specs/home.screen.html",
                screen("<h1>Changed</h1>", ""),
            );
            write(path, "specs/added.screen.html", screen("<p>Added</p>", ""));
            write(
                path,
                "specs/ignored.screen.html",
                screen(r#"<mokly-ignore id="clock">After</mokly-ignore>"#, ""),
            );
            fs::remove_file(path.join("specs/retired.screen.html")).unwrap();
        }
        let built = changes::build(&mokly(), path, &["--debug-timings"], "rich");
        let all = timings(&built.finished.stderr);
        let compared = records(&all, "review.compare-views");
        assert_eq!(events(&compared), ["start", "counts", "end"]);
        let count = compared[1];
        let counts: Vec<_> = ["views", "unchanged", "changed", "ignoredOnly"]
            .iter()
            .map(|field| count[*field].as_u64().unwrap())
            .collect();
        assert_eq!(counts, if change { [11, 3, 6, 2] } else { [9, 9, 0, 0] });
        assert_eq!(compared[2]["status"], "ok");
        for record in [compared[0], compared[2]] {
            for field in ["views", "unchanged", "changed", "ignoredOnly"] {
                assert!(record.get(field).is_none(), "{field}");
            }
        }
        assert_eq!(count["id"], compared[0]["id"]);
        assert!(records(&all, "review.changed-paths").is_empty());
        for record in &compared {
            assert!(!record.to_string().contains(&root_text));
            let extra: Vec<_> = record
                .as_object()
                .unwrap()
                .keys()
                .filter(|key| !allowed.contains(&key.as_str()))
                .collect();
            assert!(extra.is_empty(), "{extra:?}");
        }
    }
}

#[test]
fn base_capture_timings_report_bounded_retention_and_encoded_payload_bytes() {
    let fixture = changes::fixture();
    let built = changes::build(&mokly(), fixture.root.path(), &["--debug-timings"], "rich");
    let all = timings(&built.finished.stderr);
    let captured = records(&all, "review.capture-side");
    assert_eq!(events(&captured), ["start", "counts", "end"]);
    let counts = captured[1];
    let number = |field: &str| counts[field].as_u64().unwrap();
    assert_eq!(number("views"), 6);
    assert_eq!(number("uncapturedViews"), 0);
    assert!(number("encodedBytes") > 0);
    assert!(number("retainedBytes") >= number("encodedBytes"));
    assert!(number("retainedBytes") <= 256 * 1024 * 1024);
    assert_eq!(captured[2]["status"], "ok");
    for field in ["views", "uncapturedViews", "retainedBytes", "encodedBytes"] {
        assert!(captured[0].get(field).is_none(), "{field}");
    }
    assert!(captured[2].get("uncapturedViews").is_none());
    let starts = |id: &Value| {
        all.iter()
            .map(|record| &record.0)
            .find(|record| record["event"] == "start" && record["id"] == *id)
            .unwrap()
    };
    let parent = starts(&counts["parentId"]);
    assert_eq!(parent["stage"], "review.base-tree");
    for record in &captured {
        assert_eq!(record["role"], "core");
        assert_eq!(record["session"], parent["session"]);
        assert_eq!(record["parentId"], parent["id"]);
        assert!(record.get("path").is_none());
        assert!(record.get("props").is_none());
    }
    let validation = all
        .iter()
        .map(|record| &record.0)
        .find(|record| record["stage"] == "review.capture-validate" && record["event"] == "start")
        .expect("a validation span");
    for (stage, count) in [
        ("review.capture-validate", 1),
        ("review.capture-document", 6),
        ("review.capture-encode", 6),
        ("review.capture-closure", 6),
    ] {
        let ended: Vec<_> = records(&all, stage)
            .into_iter()
            .filter(|record| record["event"] == "end")
            .collect();
        assert_eq!(ended.len(), count, "{stage}");
        for record in ended {
            assert_eq!(record["status"], "ok");
            let expected = if stage == "review.capture-validate" {
                &counts["id"]
            } else {
                &validation["id"]
            };
            assert_eq!(&record["parentId"], expected);
            assert_eq!(record["session"], counts["session"]);
            assert!(record.get("path").is_none());
            assert!(record.get("props").is_none());
        }
    }
}
