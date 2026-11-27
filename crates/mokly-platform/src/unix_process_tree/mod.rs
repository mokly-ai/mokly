//! Unix ownership of descendants across process groups and sessions.

mod group;
mod outcome;
mod unattached;
mod walk;

pub(super) use group::{GroupSignal, attach};
pub(super) use outcome::GroupOutcome;
pub(super) use unattached::kill_unattached;
