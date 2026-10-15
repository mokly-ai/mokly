//! Local catalogue HTTP delivery with injected rendering and lifecycle services.

#![warn(unreachable_pub)]

pub mod application;
pub mod assets;
pub mod backend;
pub mod clock;
pub mod diagnostics;
pub mod entropy;
pub mod error;
mod live;
pub mod preview;
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
