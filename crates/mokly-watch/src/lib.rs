//! File observation, confined watch plans, and serial action batches.
#![warn(unreachable_pub)]
pub mod backend;
pub mod error;
pub mod event;
pub mod native;
mod native_events;
mod native_scan;
pub mod observer;
mod pattern;
pub mod plan;

#[cfg(test)]
#[path = "_tests_/observer_tests.rs"]
mod observer_tests;
#[cfg(test)]
#[path = "_tests_/plan_tests.rs"]
mod plan_tests;

#[cfg(test)]
#[path = "_tests_/resolution_tests.rs"]
mod resolution_tests;
