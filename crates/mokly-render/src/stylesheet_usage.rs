//! Root-local dependency reads stay private until their serial position is reached.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use crate::dependency_usage::{DependencyUsage, UsedDependencies};

enum Usage {
    Record(BTreeMap<String, String>, String),
    Unmapped(String),
}

/// Raw dependency calls retain their aliases and order until the caller replays them.
pub(crate) struct BufferedUsage {
    target: Arc<dyn DependencyUsage>,
    calls: Mutex<Vec<Usage>>,
}

impl BufferedUsage {
    /// Buffer calls for the original side's usage collector.
    pub(crate) fn new(target: Arc<dyn DependencyUsage>) -> Self {
        Self {
            target,
            calls: Mutex::default(),
        }
    }

    /// Apply this root's complete or partial usage once at its serial position.
    pub(crate) fn replay(&self) {
        let calls = {
            let mut calls = self.calls.lock().unwrap_or_else(|error| error.into_inner());
            std::mem::take(&mut *calls)
        };
        apply(&calls, self.target.as_ref());
    }

    fn replay_into(&self, target: &dyn DependencyUsage) {
        let calls = self.calls.lock().unwrap_or_else(|error| error.into_inner());
        apply(&calls, target);
    }

    fn collected(&self) -> UsedDependencies {
        let collected = UsedDependencies::default();
        self.replay_into(&collected);
        collected
    }
}

fn apply(calls: &[Usage], target: &dyn DependencyUsage) {
    for call in calls {
        match call {
            Usage::Record(aliases, path) => target.record(aliases, path),
            Usage::Unmapped(directory) => target.unmapped(directory),
        }
    }
}

impl DependencyUsage for BufferedUsage {
    fn record(&self, aliases: &BTreeMap<String, String>, path: &str) {
        self.calls
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .push(Usage::Record(aliases.clone(), path.into()));
    }

    fn unmapped(&self, directory: &str) {
        self.calls
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .push(Usage::Unmapped(directory.into()));
    }

    fn directories(&self) -> Vec<String> {
        self.collected().directories()
    }

    fn unmapped_directories(&self) -> Vec<String> {
        self.collected().unmapped_directories()
    }
}
