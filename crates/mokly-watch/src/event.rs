//! Event descriptors and strongest-action coalescing contain no IO.

use std::collections::BTreeMap;
use std::path::PathBuf;

/// Watch actions ordered from least to greatest impact.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Action {
    /// Refresh referenced document resources.
    Reload,
    /// Recompute changed graph nodes and discovery.
    Rebuild,
    /// Reload configuration and replace the effective watch roots.
    Config,
}

impl Action {
    /// Diagnostic timing label without authored data.
    pub fn label(self) -> &'static str {
        match self {
            Self::Reload => "reload",
            Self::Rebuild => "rebuild",
            Self::Config => "config",
        }
    }
}

/// File identity supplied by the observer without an extra stat.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// Regular-file create, write, or remove.
    File,
    /// Directory create, move, or remove.
    Directory,
    /// Raw rename fallback needs a node lookup.
    Rename,
}

/// Latest observed descriptor for one lexical path.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Event {
    /// Absolute lexical input path.
    pub path: PathBuf,
    /// Event node identity.
    pub kind: Kind,
}

/// One serial action keeps every candidate even when a stronger action wins.
#[derive(Clone, Debug, Default)]
pub struct Batch {
    /// Most severe queued action.
    pub action: Option<Action>,
    /// Latest descriptor by path, in stable path order.
    pub events: BTreeMap<PathBuf, Event>,
}

impl Batch {
    /// Accumulate an accepted event.
    pub fn insert(&mut self, event: Event, action: Action) {
        self.action = Some(self.action.map_or(action, |previous| previous.max(action)));
        self.events.insert(event.path.clone(), event);
    }

    /// Request a manual rebuild through the same serial action.
    pub fn rebuild(&mut self) {
        self.action = Some(self.action.unwrap_or(Action::Rebuild).max(Action::Rebuild));
    }
}
