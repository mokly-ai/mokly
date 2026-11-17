//! Precharge owned evidence and share each retained containment allocation once.

use std::collections::BTreeMap;
use std::mem;
use std::sync::Arc;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::review::EntryChangeReason;

use crate::comparison_views::ImmutableView;
use crate::instance_proof::InstanceProof;
use crate::reuse_budget::{Charge, Resident};
use crate::rule_weight;

pub(crate) fn owned(view: &ImmutableView, warnings: &[Warning]) -> usize {
    mem::size_of::<ImmutableView>()
        + 64
        + view
            .document
            .before_route
            .as_ref()
            .map_or(0, String::capacity)
        + view
            .document
            .after_route
            .as_ref()
            .map_or(0, String::capacity)
        + strings(&view.document.ignored_ids)
        + view.document.evidence.resources.capacity() * mem::size_of::<ResourceEvidence>()
        + view
            .document
            .evidence
            .resources
            .iter()
            .map(|resource| resource.path.capacity() + owner(&resource.owner))
            .sum::<usize>()
        + view
            .observation
            .component
            .as_ref()
            .map_or(0, String::capacity)
        + rule_weight::rules(&view.observation.rules)
        + view.proofs.capacity() * mem::size_of::<InstanceProof>()
        + view
            .proofs
            .iter()
            .map(|proof| {
                proof.component.capacity()
                    + match &proof.reason {
                        EntryChangeReason::Dependency { path } => path.capacity(),
                        _ => 0,
                    }
            })
            .sum::<usize>()
        + view.owned.retained_bytes()
        + mem::size_of_val(warnings)
        + warnings
            .iter()
            .map(|warning| {
                warning.message.len()
                    + match &warning.subject {
                        WarningSubject::Route(value)
                        | WarningSubject::Entry(value)
                        | WarningSubject::Component(value)
                        | WarningSubject::Folder(value)
                        | WarningSubject::Configuration(value) => value.len(),
                    }
            })
            .sum::<usize>()
}

pub(crate) fn shared(
    view: &ImmutableView,
    resident: &Arc<Resident>,
) -> Option<(Charge, Vec<Arc<Charge>>)> {
    let mut metadata = resident.reserve(64)?;
    let mut allocations = BTreeMap::new();
    let mut complete = true;
    for proof in view
        .observation
        .rules
        .iter()
        .chain(&view.owned.rules)
        .flat_map(|rule| &rule.selectors)
        .flat_map(|selector| &selector.matches)
    {
        proof.allocations(&mut |identity, bytes| {
            if !complete || allocations.contains_key(&identity) {
                return;
            }
            if !metadata.grow(320) {
                complete = false;
                return;
            }
            if let Some(charge) = resident.shared(identity, bytes) {
                allocations.insert(identity, charge);
            } else {
                complete = false;
            }
        });
    }
    if !complete {
        return None;
    }
    Some((metadata, allocations.into_values().collect()))
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
