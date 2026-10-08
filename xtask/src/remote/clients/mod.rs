//! Blacksmith and GitHub adapters with explicit secret-safe process requests.

pub(crate) mod blacksmith;
mod disconnect;
pub(crate) mod github;
pub(in crate::remote) mod outcome;
