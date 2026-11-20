//! Postgres query, reference and real local-file maintenance integration.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod complete_runner_tests;
mod completion_race_tests;
mod fixtures;
mod index_release_tests;
mod lifecycle_tests;
mod retained_build_fixture;
mod retention_tables_tests;
mod screen_digest_tests;
mod worker_tests;

mod check_destination_tests;
mod rejected_identity_tests;
