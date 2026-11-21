//! Typed client protocol for the optional Node render sidecar.

#![warn(unreachable_pub)]

pub mod bindings;
pub mod bundle_outcomes;
pub mod bundle_store;
pub mod capture_hint;
#[cfg(target_os = "linux")]
mod cgroup_discovery;
#[cfg(target_os = "linux")]
mod cgroup_level;
#[cfg(target_os = "linux")]
pub mod cgroup_memory;
pub mod client;
pub mod codec;
pub mod compiled;
pub mod controls;
pub mod definition_metadata;
pub mod definitions;
pub mod diagnostics;
pub mod durable_recipe;
pub mod error;
pub mod host_memory;
mod method_results;
pub mod methods;
pub mod operations;
pub mod pool;
pub mod pool_admission;
mod pool_affinity;
mod pool_bundle_cache;
pub mod pool_claim;
mod pool_cleanup;
mod pool_eager;
mod pool_exchange;
mod pool_head;
mod pool_leases;
pub mod pool_options;
mod pool_preparation;
mod pool_recipes;
mod pool_releases;
mod pool_render_equality;
mod pool_requests;
mod pool_return;
mod pool_return_spawn;
mod pool_shutdown;
mod pool_sources;
mod pool_start;
mod pool_state;
mod pool_timing;
mod pool_warmup;
mod pool_warmup_state;
pub mod postcss_evidence;
pub mod postcss_failure;
mod postcss_phase;
mod presentation;
pub mod process_clock;
mod process_completion;
mod process_control;
mod process_environment;
pub mod process_factory;
mod process_io;
pub mod process_memory;
mod process_parent;
mod process_reaper;
mod process_startup;
pub mod process_threads;
mod process_transport;
mod process_worker;
pub mod render_records;
mod request_display;
pub mod resolution_plan;
pub mod results;
pub mod reusable_recipe;
pub mod typescript;
pub mod usage;
pub mod wire;
mod wire_decode;
pub mod workers;

mod memory_schedule;
mod memory_table;
mod memory_tree;
mod pool_recycle;

#[cfg(test)]
#[path = "_tests_/head_return/mod.rs"]
mod head_return_tests;

#[cfg(test)]
#[path = "_tests_/trace_capture.rs"]
mod trace_capture;

#[cfg(test)]
#[path = "_tests_/compiled_fixture.rs"]
mod compiled_fixture;

#[cfg(test)]
#[path = "_tests_/fixture_leases.rs"]
mod fixture_leases;
