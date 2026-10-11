//! Remote verification contracts, orchestration and operating-system adapters.

pub(crate) mod availability;
mod cleanup;
pub(crate) mod clients;
pub(crate) mod contracts;
pub(crate) mod error;
pub(crate) mod logs;
mod parse;
mod phases;
mod plan;
mod policy;
pub(crate) mod process;
pub(crate) mod reporting;
pub(crate) mod runner;
pub(crate) mod runtime;
pub(crate) mod scripts;
mod suites;

#[cfg(test)]
#[path = "_tests_/adapter_support.rs"]
mod adapter_support;
