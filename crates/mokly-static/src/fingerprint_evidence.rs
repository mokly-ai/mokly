//! Static validation retains external read baselines through every cache and worker lifetime.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use mokly_source_interface::error::{self, SourceError};
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::tree::SourceTree;

use crate::error::{Error, Result};

#[derive(Default)]
pub(crate) struct Evidence {
    inputs: Mutex<BTreeMap<PathBuf, BTreeSet<ReadBaseline>>>,
    pinned_failure: Mutex<Option<PathBuf>>,
}

impl Evidence {
    pub(crate) fn record_pinned(
        &self,
        path: &Path,
        baseline: &ReadBaseline,
        digest: &str,
    ) -> error::Result<()> {
        if baseline.digest() == digest {
            return Ok(());
        }
        self.pinned_failure
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get_or_insert_with(|| path.into());
        Err(SourceError::Changed { path: path.into() })
    }
    pub(crate) fn record(&self, path: &Path, baseline: &ReadBaseline) {
        self.inputs
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(path.into())
            .or_default()
            .insert(baseline.clone());
    }

    pub(crate) fn verify(&self, captured: &dyn SourceTree, live: &dyn SourceTree) -> Result<()> {
        if let Some(path) = self
            .pinned_failure
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
        {
            return Err(Error::InputsChanged { path: path.clone() });
        }
        for (path, versions) in self
            .inputs
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
        {
            let node = captured.project(path).ok().flatten();
            let current = live.project(path).ok().flatten();
            let Some(node) = node.filter(|node| Some(node) == current.as_ref()) else {
                return Err(Error::InputsChanged { path: path.clone() });
            };
            let captured = captured.digest(&node.identity).ok();
            let current = live.digest(&node.identity).ok();
            if versions.iter().any(|version| {
                captured.as_deref() != Some(version.digest())
                    || current.as_deref() != Some(version.digest())
            }) {
                return Err(Error::InputsChanged { path: path.clone() });
            }
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/fingerprint_evidence_tests.rs"]
mod fingerprint_evidence_tests;
