//! Complete and independently selectable verification suites.

mod cloud_commands;
mod cloud_shards;
mod commands;
pub(crate) mod request;
pub(crate) mod runner;
pub(crate) mod tasks;

#[cfg(test)]
#[path = "_tests_/check_tests.rs"]
mod check_tests;
#[cfg(test)]
#[path = "_tests_/dependency_audit_tests.rs"]
mod dependency_audit_tests;

#[cfg(test)]
#[path = "_tests_/native_tests.rs"]
mod native_tests;

#[cfg(test)]
#[path = "_tests_/cloud_tests.rs"]
mod cloud_tests;

#[cfg(test)]
#[path = "_tests_/cloud_shard_tests.rs"]
mod cloud_shard_tests;

#[cfg(test)]
#[path = "_tests_/ported_stage_tests.rs"]
mod ported_stage_tests;
