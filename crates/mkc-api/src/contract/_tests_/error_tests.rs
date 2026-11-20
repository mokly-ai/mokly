//! The upstream serializer and reason catalogues satisfy the exported envelope.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeSet;

use rpc_error::{ErrorCode, RpcError};
use serde_json::{Value, json, to_value};

use crate::contract::response_validation::{document, validator_at};
use crate::error::ApiError;
use crate::error_data::VersionConflict;
use crate::error_samples::{Sample, samples};

const ERROR: &str = "/components/schemas/Error";

fn variants() -> &'static [Value] {
    document()["components"]["schemas"]["Error"]["properties"]["error"]["oneOf"]
        .as_array()
        .unwrap()
}

fn reasons(variant: &Value) -> Vec<&str> {
    variant["properties"]["reason"]["enum"]
        .as_array()
        .unwrap()
        .iter()
        .map(|reason| reason.as_str().unwrap())
        .collect()
}

fn variant_of(reason: &str) -> &'static Value {
    let mut matching = variants()
        .iter()
        .filter(|variant| reasons(variant).contains(&reason));
    let variant = matching.next().unwrap();
    assert!(matching.next().is_none(), "{reason} has two variants");
    variant
}

fn output(error: ApiError) -> Value {
    to_value(
        RpcError::from(error)
            .with_request_id("schema-test")
            .output(),
    )
    .unwrap()
}

fn catalogue() -> BTreeSet<&'static str> {
    ApiError::reason_catalogs()
        .into_iter()
        .flatten()
        .map(|item| item.reason)
        .collect()
}

#[test]
fn every_variant_that_carries_data_documents_its_type() {
    let validator = validator_at(ERROR);
    let mut tested = BTreeSet::new();
    for Sample { error, data } in samples() {
        let value = output(error);
        assert!(validator.is_valid(&value), "{value}");
        let reason = value["error"]["reason"].as_str().unwrap().to_owned();
        let variant = variant_of(&reason);
        let required = variant["required"].as_array().unwrap();
        let documented = variant["properties"].get("data");
        match data {
            Some(name) => {
                let reference = format!("#/components/schemas/{name}");
                assert_eq!(documented, Some(&json!({"$ref": reference})), "{reason}");
                assert!(required.contains(&json!("data")), "{reason}");
                assert!(value["error"].get("data").is_some(), "{reason}");
            }
            None => {
                assert_eq!(documented, None, "{reason}");
                assert!(value["error"].get("data").is_none(), "{reason}");
            }
        }
        assert!(tested.insert(reason.clone()), "{reason} is sampled twice");
    }
    assert_eq!(tested, catalogue().into_iter().map(String::from).collect());
}

#[test]
fn every_variant_is_closed_and_keys_its_data_by_reason() {
    let validator = validator_at(ERROR);
    let conflict = output(ApiError::VersionConflict(VersionConflict {
        current_version: 7,
    }));
    for value in [output(ApiError::NotFound), conflict.clone()] {
        assert!(validator.is_valid(&value), "{value}");
        let mut unknown = value.clone();
        unknown["error"]["unexpected"] = json!(true);
        assert!(!validator.is_valid(&unknown));
        let mut unknown = value;
        unknown["unexpected"] = json!(true);
        assert!(!validator.is_valid(&unknown));
    }
    let mut missing = conflict.clone();
    missing["error"].as_object_mut().unwrap().remove("data");
    let mut other = conflict.clone();
    other["error"]["data"] = json!({"buildId": "019a0000-0000-7000-8000-000000000001"});
    let mut extra = conflict;
    extra["error"]["data"]["unexpected"] = json!(true);
    let mut plain = output(ApiError::NotFound);
    plain["error"]["data"] = json!({"currentVersion": 7});
    for value in [missing, other, extra, plain] {
        assert!(!validator.is_valid(&value), "{value}");
    }
}

#[test]
fn code_enum_comes_from_upstream_serde_and_keeps_its_order() {
    for variant in variants() {
        let codes = variant["properties"]["code"]["enum"].as_array().unwrap();
        assert_eq!(codes.len(), 15);
        assert_eq!(codes.first(), Some(&json!(ErrorCode::BadRequest)));
        assert_eq!(codes.last(), Some(&json!(ErrorCode::DeadlineExceeded)));
        for code in codes {
            let parsed: ErrorCode = serde_json::from_value(code.clone()).unwrap();
            assert_eq!(to_value(parsed).unwrap(), *code);
        }
    }
}

#[test]
fn reason_enums_partition_the_sorted_complete_catalogue() {
    let mut documented = BTreeSet::new();
    for variant in variants() {
        for reason in reasons(variant) {
            assert!(documented.insert(reason), "{reason} has two variants");
        }
    }
    assert_eq!(documented, catalogue());
    assert_eq!(
        document().pointer(&format!("{ERROR}/x-reasons")),
        Some(&json!(catalogue()))
    );
    let value = json!({"error":{"code":"not-found", "reason":"not-a-reason", "message":"Missing", "request_id":"test"}});
    assert!(!validator_at(ERROR).is_valid(&value));
}
