//! Base-side sources, extraction and dependency preparation for Changes.

#![warn(unreachable_pub)]

pub mod cache;
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
mod source_cache;
pub mod source_digest;
mod source_index;
pub mod sources;
mod sources_assets;
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

mod capture_codec;
mod capture_error;
mod capture_nodes;
mod capture_styles;
mod comparison_capture;
mod comparison_error;

mod comparison_resources;
pub mod comparison_steps;
pub mod comparison_types;
mod entry_metadata;
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
pub mod base_render;
pub mod base_selection;
pub mod comparison;

pub mod lookup;

mod source_validation;

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

mod impact_validation;

mod use_case_impact;

pub mod source_failures;

mod git_failures;
mod git_prefetch;
mod git_projection;

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
mod git_asset_stream;

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

mod capture_annotations;
mod capture_usage;
mod capture_weight;

#[cfg(test)]
#[path = "_tests_/capture_engine/mod.rs"]
mod capture_engine_tests;

#[cfg(test)]
#[path = "_tests_/capture_producer.rs"]
mod capture_producer;

mod capture_collection;
