//! Content-addressed catalogue rendering and bounded process caches.
#![warn(unreachable_pub)]

pub mod background;
pub mod cache;
mod cache_encoder_pool;
mod cache_encoding;
pub mod cache_lease;
mod cache_state;
mod cache_tier;
mod cache_transit;
pub mod closure;
pub mod collection;
pub mod comparison_input;
pub mod comparison_proof;
pub mod comparison_stream;
pub mod delivery_inputs;
mod dependency_inputs;
mod document_annotations;
pub mod document_codec;
pub mod document_error;
mod document_nodes;
mod document_records;
mod document_usage;
mod document_weight;
mod document_writer;
pub mod error;
mod fragment_weight;
pub mod fragments;
pub mod graph;
pub mod key;
mod link_index;
mod link_results;
pub mod policy;
pub mod public_denial;
pub mod public_inputs;
mod public_locations;
pub mod reference_index;
pub mod references;
pub mod render_class;
mod render_closure;
mod render_exporters;
pub mod render_inputs;
pub mod route_inventory;
pub mod source_snapshot;
pub mod types;
pub mod urls;
mod worker_context;
pub mod workers;

mod component_keys;
mod config_key;
mod evaluation;
mod markdown_assets;
mod markdown_links;
mod markdown_sources;
mod planning;
mod rendering;
mod requests;
mod resource_digests;
mod resource_edges;
pub mod resource_inputs;
mod resource_keys;
mod routing_inputs;
mod routing_records;
mod session;
mod session_proof;
mod session_render;
mod styles;
mod stylesheet_jobs;
mod stylesheet_keys;
mod validation;
mod watch_rules;
mod weight;

#[cfg(test)]
#[path = "_tests_/boundaries_tests.rs"]
mod boundaries_tests;
#[cfg(test)]
#[path = "_tests_/cache_tests.rs"]
mod cache_tests;

#[cfg(test)]
#[path = "_tests_/overlap_cache_tests.rs"]
mod overlap_cache_tests;

mod resource_access;

mod closure_prefetch;
mod closure_seeds;
#[cfg(test)]
#[path = "_tests_/rendering_tests.rs"]
mod rendering_tests;
pub mod resource_reach;
#[cfg(test)]
#[path = "_tests_/snapshot_tests.rs"]
mod snapshot_tests;

mod document_composition;
mod planning_resources;
mod temporary;

#[cfg(test)]
#[path = "_tests_/cancellation_tests.rs"]
mod cancellation_tests;

#[cfg(test)]
#[path = "_tests_/reference_tests.rs"]
mod reference_tests;

pub mod asset_delivery;

mod session_collection;
mod validation_summary;

#[cfg(test)]
#[path = "_tests_/style_memo_tests.rs"]
mod style_memo_tests;
