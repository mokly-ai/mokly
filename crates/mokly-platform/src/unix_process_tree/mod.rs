//! Unix ownership of descendants across process groups and sessions.

mod group;
mod walk;

pub(super) use group::{GroupSignal, attach};
