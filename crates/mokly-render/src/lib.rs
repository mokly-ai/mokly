//! Shared head and base JavaScript description, stylesheet, and rendering adapters.

#![warn(unreachable_pub)]

mod bundle;
mod bundle_attempt;
mod bundle_finish;
mod bundle_inputs;
mod declarations;
mod definition_handle;
mod definition_input;
mod definitions;
pub mod dependency_usage;
mod diagnostics;
mod edit_plans;
pub mod error;
mod failures;
mod fragments;
mod graph;
mod input_stamp;
mod leases;
mod persistent_identity;
pub mod physical_inputs;
mod plan_directory;
mod plan_inputs;
mod postcss;
mod postcss_cache;
mod postcss_inventory;
mod postcss_nested;
mod postcss_read_inventory;
mod postcss_scan;
mod postcss_turns;
mod render_call;
mod render_environment;
pub mod runtime;
mod runtime_factories;
pub mod side;
mod source_evidence;
mod source_lease;
mod source_paths;
mod sources;
mod stylesheet_cache;
mod stylesheet_capture;
mod stylesheet_class_maps;
mod stylesheet_commit;
mod stylesheet_compiler;
mod stylesheet_record;
mod stylesheet_store;
mod stylesheet_usage;
mod stylesheet_watch;
mod stylesheet_weight;
mod stylesheets;
mod transport_values;
mod watch_candidate;

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

#[cfg(test)]
#[path = "_tests_/source_precedence_tests.rs"]
mod source_precedence_tests;

#[cfg(test)]
#[path = "_tests_/graph_tests.rs"]
mod graph_tests;
#[cfg(test)]
#[path = "_tests_/stored_call_tests.rs"]
mod stored_call_tests;
#[cfg(test)]
#[path = "_tests_/stored_provenance_tests.rs"]
mod stored_provenance_tests;
