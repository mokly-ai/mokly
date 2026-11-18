//! Shared path safety for output admission and final filesystem writes.

use std::collections::BTreeMap;

use crate::output::error::AdmissionError;
use crate::output::validation::{MARKER, portable_path};

/// Portable output paths with exact, case, and prefix collision checks.
#[derive(Clone, Debug, Default)]
pub struct Paths {
    names: BTreeMap<String, String>,
}

impl Paths {
    /// Admit a path without reading or admitting file bytes.
    pub fn insert(&mut self, path: &str) -> Result<(), AdmissionError> {
        portable(path)?;
        self.record(path)
    }

    /// Record a path after the caller checks the portable grammar.
    pub(super) fn record(&mut self, path: &str) -> Result<(), AdmissionError> {
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
            return Err(AdmissionError::Collision {
                path: path.into(),
                other,
            });
        }
        self.names.insert(folded, path.into());
        Ok(())
    }
}

pub(super) fn portable(path: &str) -> Result<(), AdmissionError> {
    if portable_path(path).is_err() {
        return Err(AdmissionError::Portable { path: path.into() });
    }
    Ok(())
}
