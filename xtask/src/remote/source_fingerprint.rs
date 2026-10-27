//! The remote runner's fingerprint of the checkout and the snapshot,
//! computed in-process.

use std::path::Path;
use std::sync::Arc;

use crate::remote::contracts::{Fingerprint, Interrupt};
use crate::remote::error::{Error, Result};
use crate::source_tree::scan::read_source_tree;
use crate::source_tree::system::TreeSystem;

/// Reads the source-tree fingerprint and stops once an interrupt arrived.
pub(crate) struct SourceTreeFingerprint {
    /// Git and file reads of the fingerprint.
    pub(crate) tree: Arc<dyn TreeSystem>,
    /// Cancellation state.
    pub(crate) interrupt: Arc<dyn Interrupt + Send + Sync>,
}

impl Fingerprint for SourceTreeFingerprint {
    fn read(&self, cwd: &Path) -> Result<String> {
        if self.interrupt.requested() {
            return Err(Error::Cancelled);
        }
        match read_source_tree(self.tree.as_ref(), cwd) {
            Ok(fingerprint) => Ok(fingerprint.to_string()),
            Err(source) => Err(Error::SourceTree { source }),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/source_fingerprint_tests.rs"]
mod source_fingerprint_tests;
