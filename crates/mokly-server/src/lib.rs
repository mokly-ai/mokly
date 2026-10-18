//! Local catalogue HTTP delivery with injected rendering and lifecycle services.

#![warn(unreachable_pub)]

mod accept;
pub mod application;
mod application_evidence;
pub mod assets;
pub mod backend;
pub mod background;
pub mod changes;
pub mod changes_background;
mod changes_detail;
mod changes_execution;
pub mod changes_install;
pub mod changes_signal;
mod clients;
pub mod clock;
pub mod comparison_capture;
mod comparison_files;
pub mod comparison_graph;
mod comparison_metadata;
mod comparison_requests;
mod comparison_routes;
pub mod comparison_store;
mod detail_encoding;
pub mod diagnostics;
pub mod entropy;
pub mod error;
pub mod evidence;
pub mod foreground;
pub mod generation;
mod live;
pub mod preview;
mod priority;
pub mod public_read;
pub mod publication;
pub mod render_request;
mod replacement;
mod response;
pub mod revision;
pub mod revision_file;
pub mod runtime;
mod security;
pub mod shutdown;
pub mod snapshot;
pub mod warnings;
pub mod work;
mod work_page;

#[cfg(test)]
#[path = "_tests_/publication_support.rs"]
mod publication_support;

#[cfg(test)]
#[path = "_tests_/evidence_scale_tests.rs"]
mod evidence_scale_tests;

#[cfg(test)]
#[path = "_tests_/replacement_tests.rs"]
mod replacement_tests;

#[cfg(test)]
#[path = "_tests_/replacement_publication_tests.rs"]
mod replacement_publication_tests;

#[cfg(test)]
#[path = "_tests_/comparison_support.rs"]
mod comparison_support;

#[cfg(test)]
#[path = "_tests_/changes_support.rs"]
mod changes_support;

#[cfg(test)]
#[path = "_tests_/changes_trace_support.rs"]
mod changes_trace_support;
