//! Serve writes the same compact review as a build, and reports base capture counts.

#![cfg(unix)]

use std::fs;

use mokly_test_support::changes;
use mokly_test_support::http;
use mokly_test_support::serve::{self, Serve, Stream};
use mokly_test_support::timings::timings;
use regex::Regex;
use serde_json::Value;

use super::support::{generation, mokly};

/// One final newline and no whitespace outside JSON strings.
fn assert_compact(text: &str) {
    assert!(
        text.ends_with("}\n"),
        "{}",
        &text[text.len().saturating_sub(40)..]
    );
    let bytes = text.as_bytes();
    let mut quoted = false;
    let mut index = 0;
    while index < bytes.len() - 1 {
        let byte = bytes[index];
        if quoted {
            if byte == b'\\' {
                index += 1;
            } else if byte == b'"' {
                quoted = false;
            }
        } else if byte == b'"' {
            quoted = true;
        } else {
            assert!(!byte.is_ascii_whitespace(), "whitespace at offset {index}");
        }
        index += 1;
    }
}

/// Every object lists its keys in UTF-16 code unit order.
fn assert_sorted(value: &Value) {
    match value {
        Value::Array(items) => items.iter().for_each(assert_sorted),
        Value::Object(object) => {
            let keys: Vec<Vec<u16>> = object
                .keys()
                .map(|key| key.encode_utf16().collect())
                .collect();
            let mut sorted = keys.clone();
            sorted.sort();
            assert_eq!(keys, sorted);
            object.values().for_each(assert_sorted);
        }
        _ => {}
    }
}

#[test]
fn build_and_serve_write_the_same_compact_review_json_for_one_comparison() {
    let fixture = changes::fixture();
    let root = fixture.root.path();
    let mut running = Serve::start(&mokly(), root, &[]);
    let origin = running.ready();
    let (index, _) = serve::completed(&origin, "home");
    assert_eq!(index["changesStatus"], "ready");
    let reply = http::get(
        &origin,
        &format!("/{}", index["comparisonUrl"].as_str().unwrap()),
    );
    assert_eq!(reply.status, 200);
    let served = reply.text();
    running.close();
    let built = changes::build(&mokly(), root, &[], "plain");
    let comparison = built.index["comparisonUrl"]
        .as_str()
        .expect("a comparison URL");
    let file = fs::read_to_string(built.output.join(comparison)).unwrap();
    assert_compact(&file);
    assert_sorted(&serde_json::from_str(&file).unwrap());
    assert_eq!(served, file);
    let removed = &built.index["removedEntries"][0]["entry"]["path"];
    let detail = fs::read_to_string(built.output.join(format!(
        "{}/entries/{}.json",
        generation(&built.index),
        removed.as_str().expect("a removed entry")
    )))
    .unwrap();
    assert!(detail.starts_with("{\n  \""), "{}", &detail[..40]);
}

#[test]
fn serve_reports_base_capture_counts_beneath_its_changes_classification() {
    let fixture = changes::fixture();
    let mut running = Serve::start(&mokly(), fixture.root.path(), &["--debug-timings"]);
    let origin = running.ready();
    let (index, _) = serve::completed(&origin, "home");
    assert_eq!(index["changesStatus"], "ready");
    let ended = Regex::new(&format!(
        "{}|{}",
        r#"(?m)^\[mokly:timing\] [^\n]*"event":"end"[^\n]*"stage":"changes\.classify""#,
        r#"(?m)^\[mokly:timing\] [^\n]*"stage":"changes\.classify"[^\n]*"event":"end""#
    ))
    .unwrap();
    let stderr = running.wait(Stream::Stderr, &ended);
    let records: Vec<Value> = timings(&stderr)
        .into_iter()
        .map(|record| record.0)
        .filter(|record| record["role"] == "core")
        .collect();
    let captured: Vec<&Value> = records
        .iter()
        .filter(|record| record["stage"] == "review.capture-side")
        .collect();
    let events: Vec<_> = captured
        .iter()
        .map(|record| record["event"].as_str().unwrap())
        .collect();
    assert_eq!(events, ["start", "counts", "end"]);
    let counts = captured[1];
    assert_eq!(counts["views"], 6);
    assert_eq!(counts["uncapturedViews"], 0);
    assert!(counts["encodedBytes"].as_u64().unwrap() > 0);
    assert!(counts["retainedBytes"].as_u64() >= counts["encodedBytes"].as_u64());
    assert_eq!(captured[2]["status"], "ok");
    let start = |id: &Value| {
        records
            .iter()
            .find(|record| record["event"] == "start" && record["id"] == *id)
            .expect("a start record")
    };
    let parent = start(&counts["parentId"]);
    assert_eq!(parent["stage"], "review.base-tree");
    let classification = start(&parent["parentId"]);
    assert_eq!(classification["stage"], "changes.classify");
    for record in &captured {
        assert_eq!(record["parentId"], parent["id"]);
        assert_eq!(record["session"], classification["session"]);
    }
    running.close();
}
