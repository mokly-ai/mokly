//! Validate the Rust-derived document before registering any Axum routes.

use std::collections::{BTreeMap, BTreeSet};

use axum::http::Method;
use axum::routing::MethodFilter;
use utoipa::openapi::OpenApi;
use utoipa::openapi::security::SecurityRequirement;

use crate::contract::operations::operations;
use crate::error::{ApiError, Result};
use crate::operation::Operation;

/// One validated operation ready for Axum registration.
pub(crate) struct Route {
    /// OpenAPI path template, using Axum-compatible named segments.
    pub(crate) path: String,
    /// The supported method for this path.
    pub(crate) filter: MethodFilter,
    /// Typed dispatch target parsed from the operation ID.
    pub(crate) operation_id: Operation,
}

/// Contract failures retained as sources of the internal API error.
#[derive(Debug, thiserror::Error)]
pub(crate) enum ContractError {
    /// An operation must identify its dispatch target.
    #[error("[mkc-api/router] missing operation ID for {method} {path}")]
    MissingOperationId { method: String, path: String },
    /// The ID does not name a supported operation.
    #[error("[mkc-api/router] unknown operation ID {id}")]
    UnknownOperationId {
        id: String,
        #[source]
        source: serde::de::value::Error,
    },
    /// Axum cannot register this HTTP method.
    #[error("[mkc-api/router] unsupported method {method} for {path}")]
    UnsupportedMethod { method: String, path: String },
    /// A method or equivalent template already owns the route.
    #[error("[mkc-api/router] duplicate route {method} {path}")]
    DuplicateRoute { method: String, path: String },
    /// Document security and dispatch capability disagree.
    #[error("[mkc-api/router] anonymous-read mismatch for {operation:?}")]
    AnonymousReadMismatch { operation: Operation },
}

/// Validate all routes before the router can receive any of them.
pub(crate) fn routes(document: &OpenApi) -> Result<Vec<Route>> {
    let mut routes = Vec::new();
    let mut seen = BTreeSet::new();
    let mut templates = BTreeMap::new();
    for (path, item) in &document.paths.paths {
        for (method, contract) in operations(item) {
            let method = method.to_ascii_uppercase();
            let unsupported = || {
                ApiError::internal(ContractError::UnsupportedMethod {
                    method: method.clone(),
                    path: path.clone(),
                })
            };
            let Ok(parsed) = method.parse::<Method>() else {
                return Err(unsupported());
            };
            let Ok(filter) = MethodFilter::try_from(parsed.clone()) else {
                return Err(unsupported());
            };
            let template = path
                .split('/')
                .map(|segment| {
                    if segment.starts_with('{') && segment.ends_with('}') {
                        "{}"
                    } else {
                        segment
                    }
                })
                .collect::<Vec<_>>()
                .join("/");
            if templates
                .insert(template, path)
                .is_some_and(|other| other != path)
                || !seen.insert((method.clone(), path))
            {
                return Err(ApiError::internal(ContractError::DuplicateRoute {
                    method,
                    path: path.clone(),
                }));
            }
            let id = contract.operation_id.as_deref().ok_or_else(|| {
                ApiError::internal(ContractError::MissingOperationId {
                    method: method.clone(),
                    path: path.clone(),
                })
            })?;
            let operation_id = match Operation::parse(id) {
                Ok(operation) => operation,
                Err(source) => {
                    return Err(ApiError::internal(ContractError::UnknownOperationId {
                        id: id.to_owned(),
                        source,
                    }));
                }
            };
            let anonymous_read = parsed == Method::GET
                && contract.security.as_ref().is_some_and(|security| {
                    security.is_empty() || security.contains(&SecurityRequirement::default())
                });
            if anonymous_read != operation_id.anonymous_read() {
                return Err(ApiError::internal(ContractError::AnonymousReadMismatch {
                    operation: operation_id,
                }));
            }
            routes.push(Route {
                path: path.clone(),
                filter,
                operation_id,
            });
        }
    }
    Ok(routes)
}
