//! Replica-local live channel service for Mokly Cloud.

#![warn(unreachable_pub)]

pub mod connection;
pub mod hub;
pub mod limits;
#[cfg(any(test, feature = "test-support"))]
pub mod memory;
pub mod outbound;

mod state;
mod tick;

#[cfg(test)]
#[path = "_tests_/support.rs"]
mod test_support;

#[cfg(test)]
#[path = "_tests_/delivery_tests.rs"]
mod delivery_tests;

#[cfg(test)]
#[path = "_tests_/limit_tests.rs"]
mod limit_tests;

#[cfg(test)]
#[path = "_tests_/tick_tests.rs"]
mod tick_tests;
