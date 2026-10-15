//! Component identity impact never rewrites an entry's own view state.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::axes::EntryKind;
use mokly_model::review::EntryChangeReason;

use crate::comparison_types::EntryClassification;
use crate::instance_proof::InstanceProof;

#[derive(Default)]
pub(crate) struct OwnImpact {
    pub(crate) render: BTreeSet<String>,
    pub(crate) dependencies: BTreeSet<(String, String)>,
}

pub(crate) fn include(
    entries: &mut [EntryClassification],
    instances: &[InstanceProof],
    own: &OwnImpact,
) {
    let mut reasons = BTreeMap::<String, Vec<EntryChangeReason>>::new();
    for proof in instances {
        let covered = match &proof.reason {
            EntryChangeReason::Implementation => own.render.contains(&proof.component),
            EntryChangeReason::Dependency { path } => own
                .dependencies
                .contains(&(proof.component.clone(), path.clone())),
            _ => true,
        };
        if !covered {
            reasons
                .entry(proof.component.clone())
                .or_default()
                .push(proof.reason.clone());
        }
    }
    for entry in entries {
        if entry.kind == EntryKind::Component
            && let Some(reasons) = reasons.remove(&entry.path)
        {
            entry.included = true;
            entry.reasons.extend(reasons);
        }
    }
}
