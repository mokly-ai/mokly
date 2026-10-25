//! Current public shapes round-trip; malformed relationships fail after the version gate.

use serde_json::{Value, json};

use crate::canonical;
use crate::readers::{ReadError, detail, index};

pub(super) fn empty_index() -> Value {
    json!({"schemaVersion":7,"identity":{"id":"a".repeat(64),"title":"Mokly"},"deploymentId":"b".repeat(64),"revision":0,
        "changesStatus":"disabled","comparisonUrl":null,"tree":[],"screens":[],"pages":[],"documents":[],"useCases":[],"components":[],"removedEntries":[]})
}

pub(super) fn metadata(path: &str) -> Value {
    json!({"path":path,"title":"Home","tags":[],"details":{"description":"","relatedDocs":[],"sourcePath":"specs/home.screen.html"},"changes":{"status":"disabled"}})
}

pub(super) fn screen(path: &str, parent: Option<&str>) -> Value {
    let mut value = metadata(path);
    value["kind"] = json!("screen");
    value["colorSchemes"] = json!(["light"]);
    value["propSchema"] = json!({"type":"object","additionalProperties":false,"properties":{"value":{"type":"number"}},"required":["value"]});
    value["props"] = json!({"value":["number","-0"]});
    value["controls"] = json!({"value":{"kind":"number"}});
    value["useCasePaths"] = json!([]);
    value["views"] = json!([
        {"viewport":"mobile","colorScheme":"light","comparison":{"status":"disabled"},"documentKey":"c".repeat(64)},
        {"viewport":"desktop","colorScheme":"light","comparison":{"status":"disabled"},"documentKey":"d".repeat(64)}]);
    if let Some(parent) = parent {
        value["variantOf"] = json!(parent);
    }
    value
}

#[test]
fn index_round_trips_empty_arrays_null_comparison_and_variant_tree() {
    let empty = index(&empty_index().to_string()).unwrap();
    assert_eq!(serde_json::to_value(&empty).unwrap(), empty_index());
    let mut value = empty_index();
    value["screens"] = json!([screen("home", None), screen("home/one", Some("home"))]);
    value["tree"] =
        json!([{"kind":"entry","path":"home","children":[{"kind":"entry","path":"home/one"}]}]);
    let decoded = index(&value.to_string()).unwrap();
    assert_eq!(serde_json::to_value(&decoded).unwrap(), value);
    insta::assert_snapshot!(
        "public_index_with_variant",
        canonical::to_string(&decoded).unwrap()
    );
}

#[test]
fn index_rejects_private_fields_bad_props_and_invalid_tree_relationships() {
    let mut good = empty_index();
    good["screens"] = json!([screen("home", None)]);
    good["tree"] = json!([{"kind":"entry","path":"home"}]);
    assert!(index(&good.to_string()).is_ok());
    let mut cases = Vec::new();
    let mut value = good.clone();
    value["screens"][0]["usage"] = json!({"status":"pending"});
    cases.push(value);
    let mut value = good.clone();
    value["screens"][0]["props"]["value"] = json!(["number", "1.0"]);
    cases.push(value);
    let mut value = good.clone();
    value["screens"][0]["propSchema"]["additionalProperties"] = json!(true);
    cases.push(value);
    let mut value = good.clone();
    value["tree"] = json!([]);
    cases.push(value);
    let mut value = good.clone();
    value["tree"] = json!([{"kind":"entry","path":"home"},{"kind":"entry","path":"home"}]);
    cases.push(value);
    let mut value = good.clone();
    value["screens"][0]["variantOf"] = json!("missing");
    cases.push(value);
    let mut value = good.clone();
    value["treeOrder"] = json!(["a/b"]);
    cases.push(value);
    let mut value = good.clone();
    value["tree"][0]["hidden"] = json!(false);
    cases.push(value);
    for value in cases {
        assert!(index(&value.to_string()).is_err(), "accepted {value}");
    }
}

#[test]
fn current_and_removed_detail_fences_are_exclusive() {
    let mut value = json!({"schemaVersion":2,"controlOrder":[],"identity":{"id":"a".repeat(64),"title":"Mokly"},"deploymentId":"b".repeat(64),"revision":0,"entry":{"path":"home","kind":"screen"},"views":[]});
    assert!(detail(&value.to_string()).is_ok());
    value["generation"] = json!("c".repeat(64));
    assert!(matches!(
        detail(&value.to_string()),
        Err(ReadError::Contract { .. })
    ));
    value.as_object_mut().unwrap().remove("deploymentId");
    value.as_object_mut().unwrap().remove("revision");
    value["entry"]["snapshotId"] = json!("d".repeat(64));
    assert!(detail(&value.to_string()).is_ok());
    value["usage"] = json!({"status":"ready"});
    assert!(detail(&value.to_string()).is_err());
}
