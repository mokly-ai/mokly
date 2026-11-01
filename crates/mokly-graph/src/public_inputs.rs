//! Public closure files shared by equal document keys across generations.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Debug;
use std::sync::Mutex;

/// Live authored closure records indexed by document key and public path.
/// Each generation applies its own policy to a matching record before admission.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClosureInputsMock))]
pub trait ClosureInputs: Debug + Send + Sync {
    /// Lease one document key while a graph uses its closure record.
    fn retain(&self, key: &str);
    /// Remove a key from both indexes after its last generation releases it.
    fn release(&self, key: &str);
    /// Record one policy-approved authored file that the document reached.
    /// Every generation that holds the key sees it at once.
    fn record(&self, key: &str, path: &str);
    /// Return the files recorded for one document key.
    fn paths(&self, key: &str) -> BTreeSet<String>;
    /// Look up one path and test only the keys that reached it against the generation's keys.
    fn contains(&self, path: &str, keys: &BTreeSet<String>) -> bool;
}

#[derive(Debug, Default)]
struct Record {
    users: usize,
    paths: BTreeSet<String>,
}

#[derive(Debug, Default)]
struct Indexes {
    keys: BTreeMap<String, Record>,
    paths: BTreeMap<String, BTreeSet<String>>,
}

/// In-memory closure records with the same lease lifetime as resource inputs.
#[derive(Debug, Default)]
pub struct MemoryClosureInputs {
    records: Mutex<Indexes>,
}

impl ClosureInputs for MemoryClosureInputs {
    fn retain(&self, key: &str) {
        self.records
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .keys
            .entry(key.into())
            .or_default()
            .users += 1;
    }

    fn release(&self, key: &str) {
        let mut records = self
            .records
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(record) = records.keys.get_mut(key) {
            record.users = record.users.saturating_sub(1);
        }
        if records
            .keys
            .get(key)
            .is_some_and(|record| record.users == 0)
            && let Some(record) = records.keys.remove(key)
        {
            for path in record.paths {
                if let Some(keys) = records.paths.get_mut(&path) {
                    keys.remove(key);
                    if keys.is_empty() {
                        records.paths.remove(&path);
                    }
                }
            }
        }
    }

    fn record(&self, key: &str, path: &str) {
        let mut records = self
            .records
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        records
            .keys
            .entry(key.into())
            .or_default()
            .paths
            .insert(path.into());
        records
            .paths
            .entry(path.into())
            .or_default()
            .insert(key.into());
    }

    fn paths(&self, key: &str) -> BTreeSet<String> {
        self.records
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .keys
            .get(key)
            .map_or_else(BTreeSet::new, |record| record.paths.clone())
    }

    fn contains(&self, path: &str, keys: &BTreeSet<String>) -> bool {
        self.records
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .paths
            .get(path)
            .is_some_and(|reached| reached.iter().any(|key| keys.contains(key)))
    }
}
