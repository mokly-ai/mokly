//! Operation inventory, security and reason coverage for the complete document.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeSet;

use serde_json::Value;

use crate::error::ApiError;
use crate::operation::Operation;

use super::enum_values::enum_values;
use super::response_validation::document;
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
            "rotateSession",
            "signOut",
            "verifyGitHubSignIn",
            "verifyMagicLink",
            "verifyPreviewSignIn",
        ])
    );
}
