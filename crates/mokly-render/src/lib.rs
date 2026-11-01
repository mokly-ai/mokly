//! Shared head and base JavaScript description, stylesheet, and rendering adapters.

#![warn(unreachable_pub)]

mod bundle;
mod bundle_attempt;
mod bundle_inputs;
mod declarations;
mod definition_input;
mod definitions;
pub mod dependency_usage;
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
mod postcss_read_inventory;
mod postcss_scan;
mod postcss_turns;
mod render_environment;
pub mod runtime;
pub mod side;
mod source_evidence;
mod source_lease;
mod source_paths;
mod sources;
mod stylesheet_cache;
mod stylesheet_record;
mod stylesheet_store;
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

#[cfg(test)]
#[path = "_tests_/runtime_serialization_tests.rs"]
mod runtime_serialization_tests;
#[cfg(test)]
#[path = "_tests_/source_forwarding_tests.rs"]
mod source_forwarding_tests;

mod source_asset_io;
#[cfg(test)]
#[path = "_tests_/source_precedence_tests.rs"]
mod source_precedence_tests;
