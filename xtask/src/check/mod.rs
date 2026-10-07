//! Complete and independently selectable verification suites.

mod commands;
pub(crate) mod request;
pub(crate) mod runner;

#[cfg(test)]
#[path = "_tests_/check_tests.rs"]
mod check_tests;
#[cfg(test)]
#[path = "_tests_/dependency_audit_tests.rs"]
mod dependency_audit_tests;
