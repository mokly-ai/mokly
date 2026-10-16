//! Local catalogue HTTP delivery with injected rendering and lifecycle services.

#![warn(unreachable_pub)]

mod accept;
pub mod application;
mod application_evidence;
pub mod assets;
pub mod backend;
pub mod background;
pub mod clock;
mod detail_encoding;
pub mod diagnostics;
pub mod entropy;
pub mod error;
pub mod evidence;
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
pub mod work;

#[cfg(test)]
#[path = "_tests_/publication_support.rs"]
mod publication_support;

#[cfg(test)]
#[path = "_tests_/evidence_scale_tests.rs"]
mod evidence_scale_tests;

#[cfg(test)]
#[path = "_tests_/replacement_tests.rs"]
mod replacement_tests;
