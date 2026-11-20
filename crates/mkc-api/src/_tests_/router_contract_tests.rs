//! Malformed document routes fail construction with a typed internal cause.

#![allow(clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;

use mkc_config::proxy::TrustedProxies;
use mkc_domain::client_origins::AdmittedOrigins;
use unimock::Unimock;
use utoipa::OpenApi;
use utoipa::openapi;
use utoipa::openapi::security::SecurityRequirement;

use crate::contract::document::ApiDoc;
use crate::error::ApiError;
use crate::route_contract::ContractError;
use crate::router::RouterFactory;

#[test]
fn unknown_and_missing_operation_ids_have_typed_causes() {
    let mut document = ApiDoc::openapi();
    document
        .paths
        .paths
        .get_mut("/v1/health")
        .unwrap()
        .get
        .as_mut()
        .unwrap()
        .operation_id = Some("unknownOperation".into());
    assert_failure(
        &document,
        |error| matches!(error, ContractError::UnknownOperationId { id, .. } if id == "unknownOperation"),
    );
    document
        .paths
        .paths
        .get_mut("/v1/health")
        .unwrap()
        .get
        .as_mut()
        .unwrap()
        .operation_id = None;
    assert_failure(&document, |error| {
        matches!(error, ContractError::MissingOperationId { .. })
    });
}

#[test]
fn unsupported_standard_and_additional_methods_have_typed_causes() {
    for method in ["QUERY", "BREW", "invalid method"] {
        let mut document = ApiDoc::openapi();
        let item = document.paths.paths.get_mut("/v1/health").unwrap();
        let operation = item.get.take().unwrap();
        if method == "QUERY" {
            item.query = Some(operation);
        } else {
            item.additional_operations
                .insert(method.to_owned(), operation);
        }
        assert_failure(&document, |error| {
            matches!(error, ContractError::UnsupportedMethod { .. })
        });
    }
}

#[test]
fn duplicate_methods_and_equivalent_path_templates_have_typed_causes() {
    let mut document = ApiDoc::openapi();
    let item = document.paths.paths.get_mut("/v1/health").unwrap();
    item.additional_operations
        .insert("get".into(), item.get.clone().unwrap());
    assert_failure(&document, |error| {
        matches!(error, ContractError::DuplicateRoute { .. })
    });

    let mut document = ApiDoc::openapi();
    let item = document.paths.paths["/v1/projects/{projectId}"].clone();
    document
        .paths
        .paths
        .insert("/v1/projects/{otherId}".into(), item);
    assert_failure(&document, |error| {
        matches!(error, ContractError::DuplicateRoute { .. })
    });
}

#[test]
fn anonymous_security_uses_only_get_and_empty_requirements() {
    let session = SecurityRequirement::new("session", Vec::<String>::new());
    for security in [
        Some(vec![]),
        Some(vec![SecurityRequirement::default()]),
        Some(vec![session.clone(), SecurityRequirement::default()]),
    ] {
        let mut document = ApiDoc::openapi();
        document
            .paths
            .paths
            .get_mut("/v1/health")
            .unwrap()
            .get
            .as_mut()
            .unwrap()
            .security = security;
        assert!(factory().build_document(&document).is_ok());
    }
    for security in [None, Some(vec![session])] {
        let mut document = ApiDoc::openapi();
        document
            .paths
            .paths
            .get_mut("/v1/health")
            .unwrap()
            .get
            .as_mut()
            .unwrap()
            .security = security;
        document.security = Some(vec![]);
        assert_failure(&document, |error| {
            matches!(error, ContractError::AnonymousReadMismatch { .. })
        });
    }
    let mut document = ApiDoc::openapi();
    let item = document.paths.paths.get_mut("/v1/health").unwrap();
    item.post = item.get.take();
    assert_failure(&document, |error| {
        matches!(error, ContractError::AnonymousReadMismatch { .. })
    });
    let mut document = ApiDoc::openapi();
    document
        .paths
        .paths
        .get_mut("/v1/session")
        .unwrap()
        .get
        .as_mut()
        .unwrap()
        .security = Some(vec![]);
    assert_failure(&document, |error| {
        matches!(error, ContractError::AnonymousReadMismatch { .. })
    });
}

fn assert_failure(document: &openapi::OpenApi, expected: fn(&ContractError) -> bool) {
    let Err(ApiError::Internal(error)) = factory().build_document(document) else {
        panic!("malformed document must fail router construction");
    };
    let cause = error
        .source_chain()
        .find_map(|cause| cause.downcast_ref::<ContractError>())
        .unwrap();
    assert!(expected(cause), "{cause:?}");
}

pub(super) fn factory() -> RouterFactory {
    RouterFactory {
        trusted_proxies: TrustedProxies::default(),
        dispatcher: Arc::new(Unimock::new(())),
        upload: Arc::new(Unimock::new(())),
        origins: AdmittedOrigins::new("https://app.example.com".into(), false),
        billing_configured: true,
    }
}
