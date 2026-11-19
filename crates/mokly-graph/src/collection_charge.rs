//! Encoded capture inputs charge each owned closure record and string once.

use std::mem;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};

use crate::closure::Closure;
use crate::resource_reach::ResourceReach;

/// Conservative retained-memory charge of a validated authored closure.
pub fn closure(closure: &Closure) -> usize {
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
