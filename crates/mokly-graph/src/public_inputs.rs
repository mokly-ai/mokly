//! Public closure files shared by equal document keys across generations.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Debug;
use std::sync::Mutex;

/// Cross-generation authored closure files keyed by a document recipe.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClosureInputsMock))]
pub trait ClosureInputs: Debug + Send + Sync {
    /// Lease one document key while a graph uses its closure record.
    fn retain(&self, key: &str);
    /// Release one document key after the graph drops its plans.
    fn release(&self, key: &str);
    /// Record one policy-approved authored file reached by the document.
    fn record(&self, key: &str, path: &str);
    /// Return the files recorded for one document key.
    fn paths(&self, key: &str) -> BTreeSet<String>;
}

#[derive(Debug, Default)]
struct Record {
    users: usize,
    paths: BTreeSet<String>,
}

/// In-memory closure records with the same lease lifetime as resource inputs.
#[derive(Debug, Default)]
pub struct MemoryClosureInputs {
    records: Mutex<BTreeMap<String, Record>>,
}

impl ClosureInputs for MemoryClosureInputs {
    fn retain(&self, key: &str) {
        self.records
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(key.into())
            .or_default()
            .users += 1;
    }

    fn release(&self, key: &str) {
        let mut records = self
            .records
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(record) = records.get_mut(key) {
            record.users = record.users.saturating_sub(1);
        }
        if records.get(key).is_some_and(|record| record.users == 0) {
            records.remove(key);
        }
    }

    fn record(&self, key: &str, path: &str) {
        self.records
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(key.into())
            .or_default()
            .paths
            .insert(path.into());
    }

    fn paths(&self, key: &str) -> BTreeSet<String> {
        self.records
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(key)
            .map_or_else(BTreeSet::new, |record| record.paths.clone())
    }
}
