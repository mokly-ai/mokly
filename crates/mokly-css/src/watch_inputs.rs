//! Delivery-only resolution watch metadata stays separate from compiled input identities.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

/// Exact physical candidates and the dependency folder that admits each dependency input.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct WatchInputs {
    /// Written repair paths and admitted physical candidates.
    pub files: BTreeSet<String>,
    /// Selected or nested dependency folders, keyed by their exact candidate paths.
    pub dependency_roots: BTreeMap<String, PathBuf>,
}
