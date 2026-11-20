//! In-process durable GitHub delivery processing behind injected handler traits.

pub(crate) mod handlers;
pub(crate) mod worker;

mod apply;
mod builds;
mod events;
mod prepare;
mod snapshot;
