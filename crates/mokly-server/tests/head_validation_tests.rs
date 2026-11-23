//! Real graph validation and frozen comparison proofs across successive edits.

#[path = "head_validation/composed.rs"]
mod composed;
#[path = "head_validation/error_tests.rs"]
mod error_tests;
#[path = "head_validation/reuse_tests.rs"]
mod reuse_tests;
#[path = "head_validation/support.rs"]
mod support;
#[path = "head_validation/trap_tests.rs"]
mod trap_tests;
#[path = "head_validation/unavailable.rs"]
mod unavailable;
