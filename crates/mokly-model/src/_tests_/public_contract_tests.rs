//! Public kind fixtures and structural rules for historical records and details.

use std::fmt::Debug;

use serde_json::{Value, json};

use crate::read_contract::ContractViolation;
use crate::readers::public_reader_tests::{empty_index, metadata, screen};
use crate::readers::{ReadError, detail, index};

fn page(path: &str) -> Value {
    let mut value = metadata(path);
    value["kind"] = json!("page");
    value["documentKey"] = json!("a".repeat(64));
    value
}

fn removed() -> Value {
    let mut entry = page("old");
    entry["changes"] = json!({"status":"ready","kind":"removed","included":true});
    json!({"entry":entry,"folderTitles":[],"snapshotId":"d".repeat(64)})
}

fn generation_url() -> String {
    format!("mokly-viewer/diffs/generations/{}/", "c".repeat(64))
}

fn expect_contract<T: Debug>(result: Result<T, ReadError>, expected: ContractViolation) {
    let error = result.unwrap_err();
    let ReadError::Contract { message, .. } = error else {
        panic!("{error:?}")
    };
    assert_eq!(message, expected);
}

#[test]
fn every_entry_kind_and_a_removed_record_round_trip() {
    let mut value = empty_index();
    let mut home = screen("home", None);
    home["useCasePaths"] = json!(["tour"]);
    let mut component = screen("button", None);
    component.as_object_mut().unwrap().remove("useCasePaths");
    component["kind"] = json!("component");
    component["slots"] = json!([]);
    component["suppliedSlots"] = json!([]);
    component["comparison"] = json!({"status":"disabled"});
    let mut document = metadata("guide");
    document["kind"] = json!("document");
    document["colorSchemes"] = json!(["light"]);
    document["documentKeys"] = json!([{"colorScheme":"light","documentKey":"e".repeat(64)}]);
    let mut flow = metadata("tour");
    flow["kind"] = json!("use-case");
    flow["steps"] = json!([{"screenPath":"home"}]);
    value["screens"] = json!([home]);
    value["components"] = json!([component]);
    value["pages"] = json!([page("about")]);
    value["documents"] = json!([document]);
    value["useCases"] = json!([flow]);
    value["tree"] = json!([{"kind":"entry","path":"about"},{"kind":"entry","path":"button"},
        {"kind":"entry","path":"guide"},{"kind":"entry","path":"home"},{"kind":"entry","path":"tour"}]);
    value["removedEntries"] = json!([removed()]);
    value["comparisonUrl"] = json!(generation_url());
    assert_eq!(
        serde_json::to_value(index(&value.to_string()).unwrap()).unwrap(),
        value
    );
}

#[test]
fn invalid_removed_records_and_generation_urls_are_rejected() {
    let mut good = empty_index();
    good["removedEntries"] = json!([removed()]);
    good["comparisonUrl"] = json!(generation_url());
    assert!(index(&good.to_string()).is_ok());
    let mut cases = Vec::new();
    for (pointer, replacement, expected) in [
        (
            "/comparisonUrl",
            json!("not/a/generation/url"),
            ContractViolation::ComparisonUrl,
        ),
        (
            "/comparisonUrl",
            json!(format!("{}review.json", generation_url())),
            ContractViolation::ComparisonUrl,
        ),
        (
            "/changesStatus",
            json!("ready"),
            ContractViolation::BaseCommit,
        ),
        (
            "/removedEntries/0/entry/previousPath",
            json!("earlier"),
            ContractViolation::RemovedPreviousPath,
        ),
        (
            "/removedEntries/0/parentTitle",
            json!("Parent"),
            ContractViolation::RemovedParentTitle,
        ),
        (
            "/removedEntries/0/snapshotId",
            json!("not-a-hash"),
            ContractViolation::Snapshot,
        ),
        (
            "/removedEntries/0/entry/changes/kind",
            json!("changed"),
            ContractViolation::RemovedChanges,
        ),
    ] {
        let mut value = good.clone();
        if pointer.ends_with("previousPath") {
            value["removedEntries"][0]["entry"]["previousPath"] = replacement;
        } else if pointer.ends_with("parentTitle") {
            value["removedEntries"][0]["parentTitle"] = replacement;
        } else {
            *value.pointer_mut(pointer).unwrap() = replacement;
        }
        cases.push((value, expected));
    }
    let mut value = good.clone();
    value["removedEntries"][0]
        .as_object_mut()
        .unwrap()
        .remove("snapshotId");
    cases.push((value, ContractViolation::MissingSnapshot));
    let mut value = good.clone();
    value["removedEntries"]
        .as_array_mut()
        .unwrap()
        .push(removed());
    cases.push((value, ContractViolation::DuplicateRemovedPath));
    let mut value = good.clone();
    let mut other = removed();
    other["entry"]["path"] = json!("other");
    value["removedEntries"].as_array_mut().unwrap().push(other);
    cases.push((value, ContractViolation::Snapshot));
    let mut value = good.clone();
    value["baseCommit"] = json!("b".repeat(40));
    cases.push((value, ContractViolation::BaseCommit));
    let mut value = good.clone();
    value["changesStatus"] = json!("ready");
    value["baseCommit"] = json!("B".repeat(40));
    cases.push((value, ContractViolation::BaseCommit));
    for (value, expected) in cases {
        expect_contract(index(&value.to_string()), expected);
    }
}

#[test]
fn current_entries_cannot_have_removed_aggregate_changes() {
    let mut value = empty_index();
    let mut current = page("about");
    current["changes"] = json!({"status":"ready","kind":"removed","included":true});
    value["pages"] = json!([current]);
    value["tree"] = json!([{"kind":"entry","path":"about"}]);
    expect_contract(index(&value.to_string()), ContractViolation::CurrentRemoved);
}

#[test]
fn historical_variants_require_a_nonempty_parent_title() {
    let mut value = empty_index();
    let mut variant = screen("old/one", Some("old"));
    variant["changes"] = json!({"status":"ready","kind":"removed","included":true});
    value["comparisonUrl"] = json!(generation_url());
    value["removedEntries"] = json!([{"entry":variant,"parentTitle":"Former parent","folderTitles":[],"snapshotId":"d".repeat(64)}]);
    assert!(index(&value.to_string()).is_ok());
    for title in [json!(""), json!("   ")] {
        value["removedEntries"][0]["parentTitle"] = title;
        expect_contract(
            index(&value.to_string()),
            ContractViolation::RemovedParentTitle,
        );
    }
    value["removedEntries"][0]["parentTitle"] = json!(42);
    assert!(matches!(
        index(&value.to_string()),
        Err(ReadError::Invalid {
            boundary: "catalogue index",
            ..
        })
    ));
    value["removedEntries"][0]
        .as_object_mut()
        .unwrap()
        .remove("parentTitle");
    expect_contract(
        index(&value.to_string()),
        ContractViolation::RemovedParentTitle,
    );
    value["removedEntries"] = json!([removed()]);
    value["comparisonUrl"] = Value::Null;
    value["removedEntries"][0]
        .as_object_mut()
        .unwrap()
        .remove("snapshotId");
    assert!(index(&value.to_string()).is_ok());
}

fn screen_detail() -> Value {
    json!({"schemaVersion":3,"controlOrder":[],"identity":{"id":"a".repeat(64),"title":"Mokly"},
        "deploymentId":"b".repeat(64),"revision":0,"entry":{"path":"home","kind":"screen"},
        "views":[{"viewport":"mobile","colorScheme":"light","usage":{"status":"ready","instances":[],"slots":[],"ranges":[]},
            "state":"unchanged","ignoredIds":[],"resourceEvidence":{"rules":[],"resources":[]}}],
        "workspace":{"comparisonEligible":false,"usedBy":[],"affected":[],"relatedComponents":[],"inputChanges":[]}})
}

#[test]
fn detail_views_usage_evidence_and_workspace_round_trip() {
    let value = screen_detail();
    assert_eq!(
        serde_json::to_value(detail(&value.to_string()).unwrap()).unwrap(),
        value
    );
    let mut page = value.clone();
    page["entry"]["kind"] = json!("page");
    page["views"] = json!([]);
    page.as_object_mut().unwrap().remove("workspace");
    page.as_object_mut().unwrap().remove("controlOrder");
    page["resourceEvidence"] = json!({"rules":[],"resources":[]});
    assert!(detail(&page.to_string()).is_ok());
    for kind in ["page", "document", "use-case"] {
        let mut invalid = value.clone();
        invalid["entry"]["kind"] = json!(kind);
        expect_contract(detail(&invalid.to_string()), ContractViolation::DetailKind);
        invalid["views"] = json!([]);
        expect_contract(detail(&invalid.to_string()), ContractViolation::DetailKind);
    }
    let mut invalid = value.clone();
    invalid["resourceEvidence"] = json!({"rules":[],"resources":[]});
    expect_contract(
        detail(&invalid.to_string()),
        ContractViolation::DetailEvidence,
    );
}

#[test]
fn view_states_and_the_base_address_travel_with_ready_evidence() {
    let value = screen_detail();
    let mut before = value.clone();
    before["before"] = json!({"path":"Home","title":"Home","props":{"value":["number","1"]}});
    assert_eq!(
        serde_json::to_value(detail(&before.to_string()).unwrap()).unwrap(),
        before
    );
    let mut cases = Vec::new();
    for field in ["state", "ignoredIds", "resourceEvidence"] {
        let mut invalid = value.clone();
        invalid["views"][0].as_object_mut().unwrap().remove(field);
        cases.push(invalid);
    }
    for ids in [json!(["b", "a"]), json!(["a", "a"]), json!(["Bad"])] {
        let mut invalid = value.clone();
        invalid["views"][0]["ignoredIds"] = ids;
        cases.push(invalid);
    }
    let mut invalid = before.clone();
    invalid["before"]["suppliedSlots"] = json!([]);
    cases.push(invalid);
    let mut invalid = before.clone();
    invalid["before"]["path"] = json!("../home");
    cases.push(invalid);
    let mut invalid = before;
    invalid.as_object_mut().unwrap().remove("deploymentId");
    invalid.as_object_mut().unwrap().remove("revision");
    invalid["generation"] = json!("c".repeat(64));
    invalid["entry"]["snapshotId"] = json!("d".repeat(64));
    cases.push(invalid);
    for invalid in cases {
        expect_contract(
            detail(&invalid.to_string()),
            ContractViolation::DetailComparison,
        );
    }
}

#[test]
fn usage_props_must_decode_as_canonical_plain_data() {
    let mut value = screen_detail();
    value["views"][0]["usage"]["instances"] = json!([{"key":"a".repeat(64),"id":"button", "componentId":"button",
        "owner":{"kind":"entry"},"order":0,"props":{"value":["number","1.0"]},"propsKey":"b".repeat(64)}]);
    expect_contract(detail(&value.to_string()), ContractViolation::UsageProps);
    value["views"][0]["usage"]["instances"][0]["props"]["value"] = json!(["number", "1"]);
    assert!(detail(&value.to_string()).is_ok());
}
