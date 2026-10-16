//! Shared head and base JavaScript description, stylesheet, and rendering adapters.

#![warn(unreachable_pub)]

mod bundle;
mod bundle_attempt;
mod bundle_inputs;
mod declarations;
mod definition_input;
mod definitions;
mod diagnostics;
pub mod error;
mod failures;
mod fragments;
mod graph;
mod input_stamp;
mod leases;
mod postcss;
mod postcss_cache;
mod postcss_inventory;
mod postcss_nested;
mod postcss_scan;
pub mod runtime;
pub mod side;
mod sources;
mod stylesheet_cache;
mod stylesheet_weight;
mod stylesheets;

#[cfg(test)]
#[path = "_tests_/nested_tests.rs"]
mod nested_tests;
#[cfg(test)]
#[path = "_tests_/postcss_tests.rs"]
mod postcss_tests;

#[cfg(test)]
#[path = "_tests_/postcss_retention_tests.rs"]
mod postcss_retention_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_snapshot_tests.rs"]
mod stylesheet_snapshot_tests;
