//! Charge encoded payloads and all extra Rust metadata against one capture budget.

use std::mem;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_graph::closure::Closure;
use mokly_graph::resource_reach::ResourceReach;
use mokly_graph::types::RenderSummary;
use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};

use crate::capture_usage;

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

/// Charge Rust metadata that stays outside the compressed tree payload.
pub(crate) fn metadata(document: &Composed) -> usize {
    capture_usage::usage(&document.usage)
        + warnings(&document.warnings)
        + strings(&document.resources)
        + strings(&document.components)
        + document.links.capacity() * mem::size_of::<Reference>()
        + document
            .links
            .iter()
            .map(|link| {
                link.source_route.capacity()
                    + link.target.capacity()
                    + link.fragment.as_ref().map_or(0, String::capacity)
            })
            .sum::<usize>()
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

/// Charge every owned closure record, string, and container.
pub(crate) fn closure(closure: &Closure) -> usize {
    mem::size_of::<Closure>()
        + warnings(&closure.warnings)
        + closure
            .files
            .iter()
            .map(|path| 256 + path.capacity())
            .sum::<usize>()
        + closure
            .edges
            .iter()
            .map(|(path, edges)| 256 + path.capacity() + strings(edges))
            .sum::<usize>()
        + closure.evidence.capacity() * mem::size_of::<ResourceEvidence>()
        + closure
            .evidence
            .iter()
            .map(|record| record.path.capacity() + owner(&record.owner))
            .sum::<usize>()
        + closure.references.capacity() * mem::size_of::<ResourceReach>()
        + closure
            .references
            .iter()
            .map(|record| {
                record.path.capacity()
                    + owner(&record.owner)
                    + record.instance_key.as_ref().map_or(0, String::capacity)
                    + record.source.capacity()
                    + record.url.capacity()
            })
            .sum::<usize>()
}

fn owner(owner: &EvidenceOwner) -> usize {
    match owner {
        EvidenceOwner::Entry => 0,
        EvidenceOwner::Component { path } => path.capacity(),
    }
}

fn strings(strings: &Vec<String>) -> usize {
    strings.capacity() * mem::size_of::<String>()
        + strings.iter().map(String::capacity).sum::<usize>()
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
