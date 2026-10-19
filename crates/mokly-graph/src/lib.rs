//! Content-addressed catalogue rendering and bounded process caches.
#![warn(unreachable_pub)]

pub mod cache;
pub mod closure;
pub mod delivery_inputs;
pub mod error;
pub mod fragments;
pub mod graph;
pub mod key;
pub mod policy;
pub mod public_denial;
pub mod reference_index;
pub mod references;
pub mod route_inventory;
pub mod source_snapshot;
pub mod types;
pub mod urls;
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
mod session;
mod session_render;
mod styles;
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

mod resource_access;

mod closure_prefetch;
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
