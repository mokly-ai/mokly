//! Recorded GitHub App smoke tests against a live API and native Postgres.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_api::contract;

mod github;
mod support;

#[path = "support/client.rs"]
mod contract_client;

#[path = "support/installed.rs"]
mod installed;

#[path = "support/server.rs"]
mod test_server;

#[path = "support/_tests_/server_tests.rs"]
mod server_tests;
