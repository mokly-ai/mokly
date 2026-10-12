//! Remote verification contracts, orchestration and operating-system adapters.

pub(crate) mod availability;
mod base;
mod cleanup;
pub(crate) mod clients;
pub(crate) mod contracts;
pub(crate) mod error;
pub(crate) mod git_identity;
pub(crate) mod identity;
pub(crate) mod logs;
mod parse;
mod phases;
mod plan;
mod policy;
mod preparation;
pub(crate) mod process;
pub(crate) mod reporting;
pub(crate) mod runner;
pub(crate) mod runtime;
pub(crate) mod scripts;
pub(crate) mod snapshot;
mod suites;

#[cfg(test)]
#[path = "_tests_/adapter_support.rs"]
mod adapter_support;

#[cfg(test)]
#[path = "_tests_/git_adapter_support.rs"]
mod git_adapter_support;

#[cfg(test)]
#[path = "_tests_/git_test_runner.rs"]
mod git_test_runner;
