//! File observation, confined watch plans, and serial action batches.
#![warn(unreachable_pub)]
pub mod error;
pub mod event;
pub mod native;
pub mod observer;
mod pattern;
pub mod plan;

#[cfg(test)]
#[path = "_tests_/observer_tests.rs"]
mod observer_tests;
#[cfg(test)]
#[path = "_tests_/plan_tests.rs"]
mod plan_tests;
