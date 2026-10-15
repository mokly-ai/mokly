//! Typed client protocol for the optional Node render sidecar.

#![warn(unreachable_pub)]

pub mod bindings;
pub mod client;
pub mod codec;
pub mod controls;
pub mod definition_metadata;
pub mod definitions;
pub mod diagnostics;
pub mod error;
pub mod methods;
pub mod pool;
pub mod pool_options;
mod pool_preparation;
mod pool_requests;
mod pool_state;
pub mod process_clock;
mod process_control;
pub mod process_factory;
mod process_io;
pub mod process_memory;
mod process_transport;
mod process_worker;
mod request_display;
pub mod results;
pub mod typescript;
pub mod usage;
pub mod wire;
pub mod workers;
