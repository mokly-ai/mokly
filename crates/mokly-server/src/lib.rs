//! Local catalogue HTTP delivery with injected rendering and lifecycle services.

#![warn(unreachable_pub)]

mod accept;
pub mod application;
mod application_evidence;
pub mod assets;
pub mod backend;
pub mod background;
pub mod clock;
pub mod diagnostics;
pub mod entropy;
pub mod error;
pub mod evidence;
mod live;
pub mod preview;
mod priority;
pub mod public_read;
pub mod publication;
pub mod render_request;
mod response;
pub mod revision;
pub mod runtime;
mod security;
pub mod shutdown;
pub mod snapshot;
pub mod stub;
pub mod work;
