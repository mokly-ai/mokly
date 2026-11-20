//! Deterministic publication service tests at injected trait boundaries.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod access_tests;
mod blob_writer_coordination_tests;
mod blob_writer_tests;
pub(crate) mod build_fixtures;
mod build_pull_rerequests_tests;
mod build_scheduler;
mod build_upload_ready_tests;
mod build_upload_tests;
mod build_worker;
mod capability_tests;
mod check_claim_clock_tests;
mod check_claim_tests;
mod check_index_tests;
mod check_recovery_tests;
mod check_retry_tests;
mod check_tests;
mod check_transient_tests;
mod completion_outcome_tests;
mod deadline_tests;
mod envelope_tests;
mod garbage_tests;
#[path = "ingest/mod.rs"]
mod ingest;
mod maintenance_tests;
mod move_summary_tests;
mod moved_screen_tests;
mod policy_tests;
mod rejected_check_tests;
mod reservation_partition_tests;
mod reservation_tests;
mod retention_tests;
mod screens_tests;
mod summary_tests;
mod support;
mod transaction_tests;

mod check_provider;
mod check_rerequests_tests;

mod index_fixture;

mod check_fixture;
