//! Rust-owned schemas and operation contracts for the platform HTTP API.

mod account;
pub(crate) mod aliases;
mod approvals;
mod billing;
pub(crate) mod bodies;
mod builds;
mod catalogue_access;
mod comments;
pub(crate) mod deferred;
pub mod document;
mod enum_values;
pub(crate) mod error;
mod github;
mod grants;
mod health;
mod members;
mod metadata;
pub(crate) mod operations;
pub(crate) mod pages;
mod parameter_schemas;
mod parameters;
mod projects;
mod publications;
mod reason_data;
mod reasons;
mod responses;
pub(crate) mod scalars;
mod session_cookie;
mod tokens;
mod uploads;
mod workspaces;

#[cfg(test)]
#[path = "_tests_/shape_tests.rs"]
mod shape_tests;

#[cfg(test)]
#[path = "_tests_/nullable_tests.rs"]
mod nullable_tests;

#[cfg(test)]
#[path = "_tests_/support.rs"]
mod support;

#[cfg(test)]
#[path = "_tests_/document_tests.rs"]
mod document_tests;

#[cfg(test)]
#[path = "_tests_/response_validation.rs"]
pub(crate) mod response_validation;

#[cfg(test)]
#[path = "_tests_/validation_tests.rs"]
mod validation_tests;

#[cfg(test)]
#[path = "_tests_/required_tests.rs"]
mod required_tests;

#[cfg(test)]
#[path = "_tests_/response_capture.rs"]
pub(crate) mod response_capture;

#[cfg(test)]
#[path = "_tests_/request_tests.rs"]
mod request_tests;

#[cfg(test)]
#[path = "_tests_/route_fixture.rs"]
pub(crate) mod route_fixture;

#[cfg(test)]
#[path = "_tests_/build_tests.rs"]
mod build_tests;
