//! Document capabilities must agree with actual typed endpoint construction.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::HashMap;

use crate::contract::route_fixture::routes;
use crate::endpoint_fixture::{body, query};
use crate::endpoints::action;
use crate::operation::Operation;
use crate::platform::error::Error;

#[test]
fn every_document_operation_dispatches_exactly_when_implemented() {
    let mut params: HashMap<_, _> = [
        "workspaceId",
        "projectId",
        "buildId",
        "publicationId",
        "memberId",
        "grantId",
        "tokenId",
    ]
    .into_iter()
    .map(|key| {
        (
            key.to_owned(),
            "00000000-0000-7000-8000-000000000001".to_owned(),
        )
    })
    .collect();
    params.insert("workspaceSlug".to_owned(), "workspace".to_owned());
    params.insert("projectSlug".to_owned(), "project".to_owned());
    for route in routes() {
        let operation = route.operation_id;
        assert_eq!(operation.implemented(), route.implemented, "{operation:?}");
        assert_eq!(
            operation.anonymous_read(),
            route.anonymous_read,
            "{operation:?}"
        );
        if operation.upload() || operation.live() {
            assert!(route.implemented, "separate handler for {operation:?}");
            continue;
        }
        let body = if operation == Operation::CancelBuild {
            Vec::new()
        } else {
            serde_json::to_vec(&body(operation)).unwrap()
        };
        let result = action(operation, &params, &body, query(operation));
        if route.implemented {
            assert!(result.is_ok(), "{operation:?}: {result:?}");
        } else {
            assert!(
                matches!(result, Err(Error::OperationUnavailable)),
                "{operation:?}"
            );
        }
    }
}

#[test]
fn catalogue_grants_reject_unknown_fields_and_nonobjects() {
    let params = ["projectId", "publicationId"]
        .map(|name| {
            (
                name.to_owned(),
                "00000000-0000-7000-8000-000000000001".to_owned(),
            )
        })
        .into_iter()
        .collect();
    for bytes in [
        b"{\"publicationId\":\"override\"}".as_slice(),
        b"[]",
        b"null",
        b"garbage",
    ] {
        assert!(matches!(
            action(Operation::IssueCatalogueGrant, &params, bytes, ""),
            Err(Error::InvalidInput)
        ));
    }
    assert!(action(Operation::IssueCatalogueGrant, &params, b"{}", "").is_ok());
}
