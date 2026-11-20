//! Real worker and check lifecycles against isolated Postgres schemas.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod check_race_tests;
mod completion_locks;
mod concurrency_tests;
mod finalization;
mod fixtures;
mod lifecycle_tests;
mod upload_exchange;
