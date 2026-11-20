//! Postgres integration tests for the private queries at READ COMMITTED and through Store.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod check_tests;
mod claim_concurrency_tests;
mod clock_guard_lock_tests;
mod clock_order_tests;
mod clock_retry_tests;
mod deletion_tests;
mod grant_concurrency_tests;
mod grant_tests;
mod history_tests;
mod lease_tests;
mod lock_order_tests;
mod lock_support;
mod log_concurrency_tests;
mod log_tests;
mod organization_tests;
mod outbox_concurrency_tests;
mod reference_tests;
mod renewal_concurrency_tests;
mod rerequest_deletion_tests;
mod rerequest_parent_batch_tests;
mod rerequest_replica_tests;
mod rerequest_support;
mod retention_parent_overlap_tests;
mod retention_tests;
mod schedule_tests;
mod schema_tests;
mod support;
