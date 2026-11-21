//! Base-side sources, extraction and dependency preparation for Changes.

#![warn(unreachable_pub)]

mod bundle_cache;
mod bundle_cache_maintenance;
mod bundle_cache_read;
pub mod bundle_cache_types;
mod bundle_cache_write;
mod bundle_codec;
mod bundle_codec_read;
mod bundle_codec_write;
mod bundle_inventory;
mod bundle_receipts;
mod bundle_storage;
pub mod bundle_store;
pub mod cache;
mod cache_lock;
pub mod cache_types;
pub mod commands;
pub mod dependencies;
pub mod dependency_paths;
pub mod error;
pub mod extraction;
pub mod extraction_snapshots;
pub mod git_tree;
pub mod inputs;
pub mod locations;
pub mod process;
mod render_admission;
mod render_batch;
mod render_disk;
pub mod render_identity;
pub mod render_image;
mod render_memory;
pub mod render_pending;
mod render_segment;
pub mod render_segment_buffer;
mod render_segment_header;
mod render_sequence;
pub mod render_store;
mod render_store_index;
mod render_store_read;
mod render_store_state;
mod render_store_write;
pub mod render_writer;
pub mod render_writer_control;
mod source_cache;
mod source_index;
pub mod sources;
mod sources_extraction;
pub mod storage;
mod storage_tree;
pub mod working_inputs;

mod berry_sources;
mod cache_maintenance;
mod cache_transient;
pub mod dependency_types;
mod durability;
mod install;
mod install_node;
mod local_packages;
mod local_specifications;
mod manager;
mod manager_classic;
mod manager_command;
mod manager_environment;
mod manager_local;
mod manager_lockfiles;
mod manager_plan;
mod manager_yaml;
mod manager_yarnrc;
mod manifest;
pub mod node_executable;
mod npm_lockfiles;
mod pnpm_lockfile;
mod programs;
mod workspace_patterns;

#[cfg(windows)]
mod windows_durability;

mod matching_tree;
mod material;
mod material_nodes;
mod material_traits;

mod move_candidates;
pub mod move_types;
pub mod moves;

mod capture_error;
mod capture_fallback;
mod capture_generation;
mod capture_restore;
mod capture_styles;
mod comparison_capture;
mod comparison_consumer;
mod comparison_documents;
mod comparison_error;
mod comparison_pipeline;
mod comparison_preparation;
mod comparison_routes;
mod comparison_slots;

mod comparison_resources;
pub mod comparison_reuse;
pub mod comparison_steps;
pub mod comparison_types;
mod entry_metadata;
mod equal_material;
mod move_lines;
mod move_text;
mod rendered_moves;
mod view_material;

mod affected;
mod comparison_address;
mod comparison_attribution;
mod comparison_views;
mod entry_classification;
mod review_projection;
mod snapshots;

pub mod ancestor_roots;
mod base_classification;
pub mod base_freshness;
mod base_reader;
pub mod base_render;
pub mod base_retention;
pub mod base_selection;
pub mod comparison;
pub mod install_inputs;

pub mod lookup;

mod move_fingerprint;

mod move_inventory;
pub mod move_similarity;

mod instance_impact;
mod root_impact;

mod css_documents;

mod material_urls;

mod removal_order;

mod instance_inputs;

mod move_context;

#[cfg(test)]
#[path = "_tests_/inline_seam_tests.rs"]
mod inline_seam_tests;

mod resource_comparison;
pub mod resource_memo;
mod resource_memo_state;

mod inline_styles;
mod instance_proof;

mod implementation;

mod use_case_impact;

pub mod source_failures;

mod git_failures;
mod git_prefetch;

mod owned_style_chain_source;
mod owned_style_instances;
mod owned_styles;

mod projection_affected;
mod projection_context;
pub mod projection_index;
mod projection_inputs;
mod projection_reference;
pub mod projection_workspace;

#[cfg(test)]
#[path = "_tests_/projection/mod.rs"]
mod projection_tests;

pub mod projection_detail;

pub mod projection_removed;

mod git_asset_io;

#[cfg(test)]
#[path = "_tests_/manager_tests.rs"]
mod manager_tests;

#[cfg(test)]
#[path = "_tests_/manager_plan_tests.rs"]
mod manager_plan_tests;

#[cfg(test)]
#[path = "_tests_/manager_lockfiles_tests.rs"]
mod manager_lockfiles_tests;

#[cfg(test)]
#[path = "_tests_/manager_classic_tests.rs"]
mod manager_classic_tests;

#[cfg(test)]
#[path = "_tests_/pnpm_lockfile_tests.rs"]
mod pnpm_lockfile_tests;

#[cfg(test)]
#[path = "_tests_/workspace_patterns_tests.rs"]
mod workspace_patterns_tests;

#[cfg(test)]
#[path = "_tests_/berry_sources_tests.rs"]
mod berry_sources_tests;

#[cfg(test)]
#[path = "_tests_/classic_manifest_paths_tests.rs"]
mod classic_manifest_paths_tests;

#[cfg(test)]
#[path = "_tests_/manager_command_tests.rs"]
mod manager_command_tests;

#[cfg(test)]
#[path = "_tests_/manager_arguments_tests.rs"]
mod manager_arguments_tests;

#[cfg(test)]
#[path = "_tests_/manager_confinement_tests.rs"]
mod manager_confinement_tests;

mod capture_weight;

#[cfg(test)]
#[path = "_tests_/capture_engine/mod.rs"]
mod capture_engine_tests;

#[cfg(test)]
#[path = "_tests_/capture_producer.rs"]
mod capture_producer;

mod capture_collection;

#[cfg(test)]
#[path = "_tests_/capture_window_fixture.rs"]
mod capture_window_fixture;

#[cfg(test)]
#[path = "_tests_/bundle_fixture.rs"]
mod bundle_fixture;

#[cfg(test)]
#[path = "_tests_/scheduling/mod.rs"]
mod scheduling_tests;

mod reuse_budget;
mod reuse_collection;
mod reuse_digest;
mod reuse_generation;
mod reuse_memo;
mod reuse_optional;
mod reuse_probes;
mod reuse_reads;
mod reuse_usage;
mod reuse_weight;
mod rule_weight;
mod validation_arena;
mod validation_facts;
mod validation_head;
mod validation_inputs;
mod validation_recording;
