//! Charge encoded payloads and all extra Rust metadata against one capture budget.

use std::mem;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_graph::types::RenderSummary;

/// Base capture capacity, independent of catalogue size.
pub(crate) const DEFAULT_BASE_CAPTURE_BYTES: usize = 256 * 1024 * 1024;

/// Head capture capacity, independent of catalogue size.
pub(crate) const DEFAULT_HEAD_CAPTURE_BYTES: usize = 256 * 1024 * 1024;

/// Monotonic reservations shared by every retained capture allocation.
pub(crate) struct Budget {
    /// Total successfully reserved bytes.
    pub(crate) retained: usize,
    bound: usize,
}

impl Budget {
    /// Start an empty budget with the supplied byte capacity.
    pub(crate) fn new(bound: usize) -> Self {
        Self { retained: 0, bound }
    }
    /// Unreserved capacity for lower-priority retained inputs.
    pub(crate) fn remaining(&self) -> usize {
        self.bound - self.retained
    }
    /// Reserve the complete charge, or leave the total unchanged.
    pub(crate) fn retain(&mut self, bytes: usize) -> bool {
        if bytes > self.bound - self.retained {
            return false;
        }
        self.retained += bytes;
        true
    }
}

/// Charge validation summary storage, including its closure and warnings.
pub(crate) fn summary(summary: &RenderSummary) -> usize {
    mem::size_of::<RenderSummary>()
        + warnings(&summary.warnings)
        + summary
            .closure
            .iter()
            .map(|path| 256 + path.capacity())
            .sum::<usize>()
}

fn warnings(warnings: &Vec<Warning>) -> usize {
    warnings.capacity() * mem::size_of::<Warning>()
        + warnings
            .iter()
            .map(|warning| {
                warning.message.capacity()
                    + match &warning.subject {
                        WarningSubject::Route(path)
                        | WarningSubject::Entry(path)
                        | WarningSubject::Component(path)
                        | WarningSubject::Folder(path)
                        | WarningSubject::Configuration(path) => path.capacity(),
                    }
            })
            .sum::<usize>()
}
