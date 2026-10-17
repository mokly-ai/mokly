//! Version gates, strict admission, canonical order, and side-bearing evidence.

use serde_json::{Value, json};

use crate::canonical;
use crate::material::{catalogue_key, historical_snapshot_key};
use crate::readers::{ReadError, change_snapshot, review};

fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/review-v8.json")).unwrap()
}

#[test]
fn valid_review_round_trips_with_explicit_empty_arrays_and_omitted_empty_evidence() {
    let result = review(&fixture().to_string()).unwrap();
    let bytes = canonical::to_string(&result).unwrap();
    insta::assert_snapshot!(bytes);
    assert_eq!(
        bytes,
        canonical::to_string(&review(&bytes).unwrap()).unwrap()
    );
    assert!(!bytes.contains("\"resources\""));
}

#[test]
fn unsupported_versions_fail_before_invalid_nested_payload_fields() {
    for version in [0, 7, 9] {
        let value = json!({"schemaVersion": version, "entries": false});
        assert!(matches!(
            review(&value.to_string()),
            Err(ReadError::Version { expected: 8, .. })
        ));
    }
    assert!(matches!(
        change_snapshot("{\"schemaVersion\":3,\"removedEntries\":false}"),
        Err(ReadError::Version { expected: 4, .. })
    ));
}

#[test]
fn readers_reject_unknown_fields_duplicate_order_and_inconsistent_side_evidence() {
    let mut cases = Vec::new();
    let mut input = fixture();
    input["extra"] = json!(true);
    cases.push(input);
    let mut input = fixture();
    input["entries"].as_array_mut().unwrap().reverse();
    cases.push(input);
    let mut input = fixture();
    input["entries"][0]["path"] = json!("other");
    cases.push(input);
    let mut input = fixture();
    input["entries"][1]["included"] = json!(true);
    cases.push(input);
    let mut input = fixture();
    input["entries"][1]["views"][0]["rules"][0]["owner"] = json!({"kind":"entry"});
    cases.push(input);
    let mut input = fixture();
    input["entries"][1]["views"][0]["resources"] = json!([]);
    cases.push(input);
    let mut input = fixture();
    input["affected"][0]["evidence"][0]["via"] = json!([]);
    cases.push(input);
    let mut input = fixture();
    input["affected"][0]["changedComponentId"] = json!("unknown");
    cases.push(input);
    let mut input = fixture();
    input["entries"][0]["previousPath"] = json!("Card");
    cases.push(input);
    let mut input = fixture();
    input["entries"][0]["reasons"][0]["path"] = json!("static/other.css");
    cases.push(input);
    let mut input = fixture();
    input["affected"][0]["consumer"]["path"] = json!("unknown");
    cases.push(input);
    let mut input = fixture();
    input["affected"][0]["evidence"][0]["context"]["entry"]["title"] = json!("Forged");
    cases.push(input);
    let mut input = fixture();
    input["affected"][0]["evidence"][0]["via"][0]["componentId"] = json!("other");
    cases.push(input);
    for (index, input) in cases.iter().enumerate() {
        assert!(review(&input.to_string()).is_err(), "case {index}");
    }
}

#[test]
fn historical_id_uses_the_permanent_catalogue_base_and_entry_preimage() {
    let identity = catalogue_key("mokly.config.json").unwrap();
    let first = historical_snapshot_key(&identity, &"a".repeat(40), "screen", "home").unwrap();
    let second = historical_snapshot_key(&identity, &"b".repeat(40), "screen", "home").unwrap();
    assert_eq!(first.len(), 64);
    assert_ne!(first, second);
    insta::assert_snapshot!(first);
}
