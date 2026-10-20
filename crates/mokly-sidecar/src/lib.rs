//! Typed client protocol for the optional Node render sidecar.

#![warn(unreachable_pub)]

pub mod bindings;
pub mod client;
pub mod codec;
pub mod compiled;
pub mod controls;
pub mod definition_metadata;
pub mod definitions;
pub mod diagnostics;
pub mod error;
pub mod methods;
pub mod operations;
pub mod pool;
mod pool_affinity;
mod pool_cleanup;
mod pool_exchange;
pub mod pool_options;
mod pool_preparation;
mod pool_releases;
mod pool_requests;
mod pool_shutdown;
mod pool_sources;
mod pool_state;
mod pool_timing;
pub mod postcss_evidence;
pub mod postcss_failure;
mod presentation;
pub mod process_clock;
mod process_completion;
mod process_control;
pub mod process_factory;
mod process_io;
pub mod process_memory;
mod process_parent;
mod process_reaper;
mod process_startup;
mod process_transport;
mod process_worker;
pub mod render_records;
mod request_display;
pub mod results;
pub mod typescript;
pub mod usage;
pub mod wire;
pub mod workers;

mod memory_schedule;
mod memory_table;
mod memory_tree;
mod pool_recycle;

#[cfg(test)]
#[path = "_tests_/trace_capture.rs"]
mod trace_capture;
