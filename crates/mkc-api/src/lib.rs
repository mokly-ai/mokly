//! Platform HTTP API composition and typed service boundaries.

#![warn(unreachable_pub)]

mod action;
pub mod application;
mod application_server;
mod billing;
mod billing_dispatch;
pub mod billing_providers;
mod billing_runtime;
pub mod build_error;
pub mod build_providers;
mod build_runtime;
mod builds;
mod check_runtime;
pub mod contract;
mod dispatch;
mod endpoints;
pub mod error;
pub mod error_data;
mod error_mapping;
mod github;
mod github_composition;
mod github_dispatch;
pub mod github_error;
pub mod github_providers;
mod github_runtime;
mod github_worker;
mod health;
mod input;
pub mod maintenance;
mod operation;
mod operation_policy;
mod pagination;
mod payload;
mod platform;
pub mod preview_seed;
mod project_input;
mod response;
mod route_contract;
mod router;
mod viewer;
mod views;

#[cfg(test)]
#[path = "_tests_/endpoint_fixture.rs"]
mod endpoint_fixture;
mod publication_views;
mod publishing;
mod publishing_storage;
mod upload;
mod upload_blob;
mod upload_blob_decode;
mod upload_complete;
pub mod upload_error;
mod upload_outcome;
mod upload_plan;
mod upload_stream;

#[cfg(test)]
#[path = "_tests_/entry_path_schema_tests.rs"]
mod entry_path_schema_tests;

#[cfg(test)]
#[path = "_tests_/error_samples.rs"]
mod error_samples;
