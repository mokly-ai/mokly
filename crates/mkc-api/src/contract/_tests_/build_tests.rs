//! Build routes retain their registry coverage and anonymous refusal transport.

#![allow(clippy::unwrap_used, clippy::panic)]

use serde_json::json;
use utoipa::OpenApi;
use utoipa::openapi::security::SecurityRequirement;

use crate::contract::document::ApiDoc;
use crate::error::ApiError;
use crate::operation::Operation;
use crate::route_contract::{ContractError, routes};

use super::response_validation::{document, validator_at};
use super::route_fixture::anonymous;

#[test]
fn every_build_route_has_its_method_path_id_and_implementation() {
    let registered = routes(&ApiDoc::openapi()).unwrap();
    for (method, tail, id, read) in [
        ("get", "history", "listHistory", true),
        ("get", "builds/{buildId}", "getBuild", true),
        ("get", "builds/{buildId}/log", "listBuildLog", true),
        ("post", "builds", "requestBuild", false),
        ("post", "builds/{buildId}/cancel", "cancelBuild", false),
    ] {
        let path = format!("/v1/projects/{{projectId}}/{tail}");
        let contract = &document()["paths"][&path][method];
        let operation = Operation::parse(id).unwrap();
        assert_eq!(contract["operationId"], id);
        assert_eq!(anonymous(method, contract), read, "{id}");
        assert_eq!(operation.anonymous_read(), read, "{id}");
        assert!(operation.implemented(), "{id}");
        assert!(contract.get("x-deferred").is_none(), "{id}");
        assert_eq!(
            registered
                .iter()
                .filter(|route| route.operation_id == operation && route.path == path)
                .count(),
            1,
            "{id}"
        );
    }
}

#[test]
fn member_only_build_reads_keep_anonymous_not_found_transport() {
    for (tail, operation) in [
        ("history", Operation::ListHistory),
        ("builds/{buildId}", Operation::GetBuild),
        ("builds/{buildId}/log", Operation::ListBuildLog),
    ] {
        let mut changed = ApiDoc::openapi();
        let path = format!("/v1/projects/{{projectId}}/{tail}");
        changed
            .paths
            .paths
            .get_mut(&path)
            .unwrap()
            .get
            .as_mut()
            .unwrap()
            .security = Some(vec![SecurityRequirement::new(
            "session",
            Vec::<String>::new(),
        )]);
        let Err(ApiError::Internal(error)) = routes(&changed) else {
            panic!("{tail}: anonymous security mismatch must fail construction");
        };
        assert!(error.source_chain().any(|cause| matches!(
            cause.downcast_ref::<ContractError>(),
            Some(ContractError::AnonymousReadMismatch { operation: actual }) if *actual == operation
        )));
    }
}

#[test]
fn build_step_is_a_nullable_finite_component() {
    let validator = validator_at("/components/schemas/BuildStep");
    for value in [
        json!("checkout"),
        json!("install"),
        json!("publish"),
        json!(null),
    ] {
        assert!(validator.is_valid(&value), "{value}");
    }
    for value in [json!("unknown"), json!(0), json!({})] {
        assert!(!validator.is_valid(&value), "{value}");
    }
}

#[test]
fn request_build_keeps_one_strict_reference_choice() {
    let validator = validator_at("/components/schemas/RequestBuild");
    for value in [json!({"branch":"main"}), json!({"pullRequest":1})] {
        assert!(validator.is_valid(&value), "{value}");
    }
    for value in [
        json!({}),
        json!({"branch":null}),
        json!({"branch":""}),
        json!({"branch":"x".repeat(256)}),
        json!({"pullRequest":0}),
        json!({"branch":"main","pullRequest":1}),
        json!({"branch":"main","extra":true}),
    ] {
        assert!(!validator.is_valid(&value), "{value}");
    }
}

#[test]
fn history_variants_are_closed_discriminated_objects() {
    let variants = document()["components"]["schemas"]["HistoryEntry"]["oneOf"]
        .as_array()
        .unwrap();
    assert_eq!(variants.len(), 2);
    for (variant, kind) in variants.iter().zip(["publication", "build"]) {
        assert_eq!(variant["additionalProperties"], false, "{kind}");
        assert_eq!(variant["properties"]["kind"]["enum"], json!([kind]));
        let required = variant["required"].as_array().unwrap();
        assert!(required.contains(&json!("kind")));
        assert!(required.contains(&json!(kind)));
    }
}
