//! Independent JSON route projection for endpoint and dispatcher coverage tests.

#![allow(clippy::unwrap_used)]

use serde_json::Value;

use crate::operation::Operation;

use super::response_validation::document;

pub(crate) struct Route {
    pub(crate) method: String,
    pub(crate) path: String,
    pub(crate) operation_id: Operation,
    pub(crate) implemented: bool,
    pub(crate) anonymous_read: bool,
}

pub(crate) fn routes() -> Vec<Route> {
    document()["paths"]
        .as_object()
        .unwrap()
        .iter()
        .flat_map(|(path, item)| {
            item.as_object()
                .unwrap()
                .iter()
                .map(|(method, contract)| Route {
                    method: method.to_ascii_uppercase(),
                    path: path.clone(),
                    operation_id: serde_json::from_value(contract["operationId"].clone()).unwrap(),
                    implemented: contract.get("x-deferred") != Some(&Value::Bool(true)),
                    anonymous_read: anonymous(method, contract),
                })
        })
        .collect()
}

pub(super) fn anonymous(method: &str, contract: &Value) -> bool {
    method == "get"
        && contract["security"].as_array().is_some_and(|security| {
            security.is_empty()
                || security
                    .iter()
                    .any(|requirement| requirement.as_object().unwrap().is_empty())
        })
}
