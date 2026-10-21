//! Source tree IO shared by discovery, rendering, and Git trees.

#![warn(unreachable_pub)]

pub mod error;
pub mod identity_evidence;
pub mod range_evidence;
pub mod read_evidence;
pub mod tree;

#[cfg(test)]
#[path = "_tests_/identity_evidence_tests.rs"]
mod identity_evidence_tests;

pub mod stream;
