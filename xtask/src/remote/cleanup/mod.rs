//! Box cleanup state, per-box actions and optional GitHub cancellation.

mod cancellation;
pub(in crate::remote) mod contracts;
pub(in crate::remote) mod guard;
mod steps;
