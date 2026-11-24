//! Document coverage continues through the final platform handler.

use std::collections::{BTreeSet, HashMap};

use mkc_domain::values::Role;
use uuid::Uuid;

use crate::contract::route_fixture::routes;
use crate::endpoint_fixture::{body, query};
use crate::endpoints::{Endpoint, action};
use crate::operation::Operation;
use crate::platform::execution::Command;

use super::query_fixture::queries;
use super::support::{PROJECT, WORKSPACE, execution};

#[test]
fn every_implemented_platform_operation_executes_a_handler() {
    let mut params: HashMap<_, _> = [
        ("workspaceId", WORKSPACE.0),
        ("projectId", PROJECT.0),
        ("buildId", Uuid::from_u128(61)),
        ("memberId", Uuid::from_u128(20)),
        ("grantId", Uuid::from_u128(31)),
        ("tokenId", Uuid::from_u128(41)),
        ("publicationId", Uuid::from_u128(51)),
    ]
    .into_iter()
    .map(|(key, id)| (key.to_owned(), id.to_string()))
    .collect();
    params.insert("workspaceSlug".to_owned(), "workspace".to_owned());
    params.insert("projectSlug".to_owned(), "project".to_owned());
    let mut auth_operations = BTreeSet::new();
    for route in routes().into_iter().filter(|route| {
        route.implemented && !route.operation_id.upload() && !route.operation_id.live()
    }) {
        let operation = route.operation_id;
        let bytes = if operation == Operation::CancelBuild {
            Vec::new()
        } else {
            serde_json::to_vec(&body(operation)).unwrap()
        };
        let endpoint = action(operation, &params, &bytes, query(operation)).unwrap();
        match endpoint {
            Endpoint::Viewer(_) => assert!(operation.anonymous_read()),
            Endpoint::Builds(_) => assert!(matches!(
                operation,
                Operation::ListHistory
                    | Operation::GetBuild
                    | Operation::ListBuildLog
                    | Operation::RequestBuild
                    | Operation::CancelBuild
            )),
            Endpoint::GitHub => assert!(operation.github()),
            Endpoint::Billing => assert!(operation.billing()),
            Endpoint::DesktopGrant => {
                assert!(operation.desktop_grant());
                auth_operations.insert("desktop-grant");
            }
            Endpoint::CatalogueGrant(_, _) => {
                assert_eq!(operation, Operation::IssueCatalogueGrant);
            }
            Endpoint::Platform(action) => {
                let mut command = execution(&action);
                command.token_secret = Some(format!("mkc_{}", "a".repeat(64)));
                let result = command.execute(&mut queries(Some(Role::Owner), &action));
                assert!(result.is_ok(), "{operation:?}: {result:?}");
            }
            Endpoint::SendMagicLink(_) => {
                assert_eq!(operation, Operation::SendMagicLink);
                auth_operations.insert("issue");
            }
            Endpoint::VerifyMagicLink(_) => {
                assert_eq!(operation, Operation::VerifyMagicLink);
                auth_operations.insert("verify");
            }
            Endpoint::VerifyPreviewSignIn(_) => {
                assert_eq!(operation, Operation::VerifyPreviewSignIn);
                auth_operations.insert("preview");
            }
            Endpoint::GetSession => {
                assert_eq!(operation, Operation::GetSession);
                auth_operations.insert("authenticate");
            }
            Endpoint::SignOut => {
                assert_eq!(operation, Operation::SignOut);
                auth_operations.insert("sign-out");
            }
            Endpoint::RotateSession => {
                assert_eq!(operation, Operation::RotateSession);
                auth_operations.insert("rotate");
            }
            Endpoint::GetHealth => {
                assert_eq!(operation, Operation::GetHealth);
                auth_operations.insert("health");
            }
        }
    }
    assert_eq!(
        auth_operations,
        BTreeSet::from([
            "issue",
            "preview",
            "desktop-grant",
            "verify",
            "authenticate",
            "sign-out",
            "rotate",
            "health"
        ])
    );
}
