//! One portable, collision-checked file inventory shared by every producer.

use std::collections::BTreeMap;

use bytes::Bytes;
use mokly_model::output::artifact::File;
use mokly_model::output::validation::{FILE_LIMIT, MARKER, portable_path};

use crate::error::{Error, Result};

/// Validated final byte set. Insertion order does not affect serialization.
#[derive(Default)]
pub struct Inventory {
    files: BTreeMap<String, File>,
    names: BTreeMap<String, String>,
}

impl Inventory {
    /// Add one file before it can reach staging or marker writing.
    pub fn insert(&mut self, path: String, bytes: Bytes) -> Result<()> {
        Self::portable(&path)?;
        if bytes.len() > FILE_LIMIT {
            return Err(Error::TooLarge { path });
        }
        self.record_path(&path)?;
        self.files.insert(path.clone(), File { path, bytes });
        Ok(())
    }

    /// Admit only a path when checking the final filesystem write inventory.
    pub(crate) fn insert_path(&mut self, path: &str) -> Result<()> {
        Self::portable(path)?;
        self.record_path(path)
    }

    fn portable(path: &str) -> Result<()> {
        if portable_path(path).is_err() {
            return Err(Error::Portable { path: path.into() });
        }
        Ok(())
    }

    fn record_path(&mut self, path: &str) -> Result<()> {
        let folded = path.to_lowercase();
        let collision = if folded == MARKER || folded.starts_with(&format!("{MARKER}/")) {
            Some(MARKER.to_owned())
        } else if let Some(previous) = self.names.get(&folded) {
            Some(previous.clone())
        } else {
            let prefix = format!("{folded}/");
            self.names
                .range(prefix.clone()..)
                .next()
                .filter(|(key, _)| key.starts_with(&prefix))
                .map(|(_, original)| original.clone())
                .or_else(|| {
                    folded
                        .match_indices('/')
                        .find_map(|(index, _)| self.names.get(&folded[..index]).cloned())
                })
        };
        if let Some(other) = collision {
            return Err(Error::Collision {
                path: path.into(),
                other,
            });
        }
        self.names.insert(folded, path.into());
        Ok(())
    }

    /// Access the complete final set, without a filesystem walk.
    pub fn into_files(self) -> Vec<File> {
        self.files.into_values().collect()
    }

    /// Borrow admitted files while computing the deployment identity.
    pub(crate) fn files(&self) -> impl Iterator<Item = &File> {
        self.files.values()
    }
}
