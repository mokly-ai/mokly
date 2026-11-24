//! Operation inventory, security and reason coverage for the complete document.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeSet;

use serde_json::{Value, json};

use crate::error::ApiError;
use crate::operation::Operation;

use super::enum_values::enum_values;
use super::response_validation::document;
use super::response_validation::validator_at;
use super::route_fixture::anonymous;

#[test]
fn every_operation_appears_once_and_has_matching_security_and_reasons() {
    let document = document();
    let mut seen = BTreeSet::new();
    let catalog: BTreeSet<_> = ApiError::reason_catalogs()
        .into_iter()
        .flatten()
        .map(|definition| definition.reason)
        .collect();
    for item in document["paths"].as_object().unwrap().values() {
        for (method, contract) in item.as_object().unwrap() {
            let id = contract["operationId"].as_str().unwrap();
            let operation: Operation =
                serde_json::from_value(contract["operationId"].clone()).unwrap();
            assert!(seen.insert(id), "duplicate operation: {id}");
            assert_eq!(
                anonymous(method, contract),
                operation.anonymous_read(),
                "{id}"
            );
            let Some(reasons) = contract.get("x-reasons") else {
                assert!(!operation.implemented(), "{id}: missing reason inventory");
                continue;
            };
            let reasons = reasons.as_array().unwrap();
            assert!(!reasons.is_empty(), "{id}: empty reason inventory");
            let mut unique = BTreeSet::new();
            for reason in reasons {
                let reason = reason.as_str().unwrap();
                assert!(catalog.contains(reason), "{id}: {reason}");
                assert!(unique.insert(reason), "duplicate reason: {id}: {reason}");
            }
        }
    }
    assert_eq!(seen, enum_values::<Operation>().iter().copied().collect());
}

#[test]
fn deferred_markers_match_operation_implementation_exactly() {
    for item in document()["paths"].as_object().unwrap().values() {
        for contract in item.as_object().unwrap().values() {
            let operation: Operation =
                serde_json::from_value(contract["operationId"].clone()).unwrap();
            let expected = (!operation.implemented()).then_some(&Value::Bool(true));
            assert_eq!(contract.get("x-deferred"), expected, "{operation:?}");
        }
    }
}

#[test]
fn the_live_operation_requires_a_session_and_documents_the_upgrade_and_refusals() {
    let doc = document();
    let operation = &doc["paths"]["/v1/live/projects/{projectId}"]["get"];
    assert_eq!(operation["operationId"], "openLiveChannel");
    assert_eq!(doc["security"], json!([{"session": []}]));
    assert!(
        operation.get("security").is_none(),
        "inherits the session requirement"
    );
    assert!(operation.get("x-deferred").is_none());
    let statuses: BTreeSet<_> = operation["responses"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(statuses, BTreeSet::from(["101", "4XX", "5XX"]));
    assert_eq!(
        operation["x-reasons"],
        json!([
            "csrf-rejected",
            "internal-error",
            "not-found",
            "session-expired",
            "unauthenticated",
            "validation-failed"
        ])
    );
    let schema = validator_at("/components/schemas/ServerMessage");
    let notice = json!({
        "type": "notice",
        "kind": "build",
        "id": "00000000-0000-0000-0000-000000000001",
        "sequence": 23,
    });
    assert!(schema.is_valid(&notice));
    assert!(schema.is_valid(&json!({"type": "resync"})));
    assert!(!schema.is_valid(&json!({"type": "notice"})));
}

#[test]
fn pages_reuse_the_named_item_component() {
    let schemas = document()["components"]["schemas"].as_object().unwrap();
    let mut count = 0;
    for (name, schema) in schemas {
        if let Some(item) = name.strip_prefix("Page_") {
            assert!(schemas.contains_key(item), "{name}");
            assert_eq!(
                schema["properties"]["items"]["items"]["$ref"],
                format!("#/components/schemas/{item}")
            );
            count += 1;
        }
    }
    assert!(count > 0);
}

#[test]
fn every_session_response_references_the_shared_cookie_header() {
    let document = document();
    let description = document["components"]["headers"]["SessionCookie"]["description"]
        .as_str()
        .unwrap();
    assert!(description.contains("SameSite=Lax"), "{description}");
    assert!(description.contains("SameSite=None"), "{description}");
    let mut operations = BTreeSet::new();
    for item in document["paths"].as_object().unwrap().values() {
        for contract in item.as_object().unwrap().values() {
            for response in contract["responses"].as_object().unwrap().values() {
                if let Some(cookie) = response.get("headers").and_then(|h| h.get("Set-Cookie")) {
                    assert_eq!(
                        cookie["$ref"], "#/components/headers/SessionCookie",
                        "{}",
                        contract["operationId"]
                    );
                    operations.insert(contract["operationId"].as_str().unwrap());
                }
            }
        }
    }
    assert_eq!(
        operations,
        BTreeSet::from([
            "exchangeDesktopGrant",
            "rotateSession",
            "signOut",
            "verifyGitHubSignIn",
            "verifyMagicLink",
            "verifyPreviewSignIn",
        ])
    );
}
