//! Real isolated Postgres maintenance queries and planner contracts.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod auth_timeout_tests;
mod blob_durability_tests;
mod candidates_tests;
mod file_release_tests;
mod fixtures;
mod github_prune_tests;
mod lock_order_tests;
mod plans_tests;
mod prune_tests;
mod records;
mod reference_plans_tests;
