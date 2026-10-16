//! Base-side sources, extraction and dependency preparation for Changes.

#![warn(unreachable_pub)]

pub mod cache;
pub mod cache_types;
pub mod commands;
pub mod dependencies;
pub mod error;
pub mod extraction;
pub mod git_tree;
pub mod inputs;
pub mod locations;
pub mod process;
mod source_cache;
pub mod sources;
pub mod storage;
mod storage_tree;
pub mod working_inputs;

mod cache_maintenance;
pub mod dependency_types;
mod durability;
mod install;
mod local_packages;
mod manifest;
mod programs;

#[cfg(windows)]
mod windows_durability;

mod matching_tree;
mod material;

mod move_candidates;
pub mod move_types;
pub mod moves;

mod comparison_error;

mod comparison_resources;
pub mod comparison_types;
mod entry_metadata;
mod move_lines;
mod move_text;
mod rendered_moves;
mod view_material;

mod affected;
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

mod git_prefetch;

mod owned_style_instances;
mod owned_styles;
