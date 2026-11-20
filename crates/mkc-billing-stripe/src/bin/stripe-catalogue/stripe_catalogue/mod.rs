//! Stripe catalogue command boundaries and reconciliation.

mod apply;
pub(crate) mod archive;
pub(crate) mod archive_decision;
pub(crate) mod args;
pub(crate) mod decision;
pub(crate) mod inputs;
pub(crate) mod report;
pub(crate) mod run_ids;
pub(crate) mod sync;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
