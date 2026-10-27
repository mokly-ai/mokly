//! The source-tree fingerprint: one digest of the tracked and non-ignored
//! working tree. The remote runner computes it for the checkout and the
//! snapshot, and each Testbox prints it for the readiness probe.

pub(crate) mod command;
pub(crate) mod error;
pub(crate) mod records;
pub(crate) mod scan;
pub(crate) mod system;

#[cfg(all(test, unix))]
#[path = "_tests_/tree_fixture.rs"]
mod tree_fixture;

#[cfg(all(test, unix))]
#[path = "_tests_/tree_tests.rs"]
mod tree_tests;

#[cfg(all(test, unix))]
#[path = "_tests_/types_tests.rs"]
mod types_tests;
