//! Exact unchanged-input instance and reference evidence, separate from own view states.

use std::collections::BTreeMap;

use mokly_graph::resource_reach::ResourceReach;
use mokly_model::catalogue::ModelEntry;
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::review::{EntryChangeReason, ReviewEntryAddress};
use mokly_model::review_affected::ReviewSide;

use crate::comparison_address::address;
use crate::comparison_resources::Resources;
use crate::comparison_types::ViewKey;
use crate::material::mapped;
use crate::view_material::MaterialComparison;

pub(crate) struct InstanceProof {
    pub(crate) component: String,
    pub(crate) instance: String,
    pub(crate) before: ReviewEntryAddress,
    pub(crate) after: ReviewEntryAddress,
    pub(crate) view: ViewKey,
    pub(crate) reason: EntryChangeReason,
    pub(crate) reference: Option<(ReviewSide, ResourceReach)>,
}

pub(crate) struct ProofInput<'a> {
    pub(crate) comparison: &'a MaterialComparison,
    pub(crate) before: &'a ModelEntry,
    pub(crate) after: &'a ModelEntry,
    pub(crate) view: ViewKey,
    pub(crate) resources: &'a Resources,
    pub(crate) evidence: &'a [ResourceEvidence],
    pub(crate) paths: &'a BTreeMap<String, String>,
}

pub(crate) fn collect(input: ProofInput<'_>) -> Vec<InstanceProof> {
    let mut output = Vec::new();
    for instance in &input.comparison.instances {
        let proof = |reason, reference| InstanceProof {
            component: instance.component.clone(),
            instance: instance.key.clone(),
            before: address(input.before),
            after: address(input.after),
            view: input.view,
            reason,
            reference,
        };
        if instance.render_changed {
            output.push(proof(EntryChangeReason::Implementation, None));
        }
        for evidence in input.evidence {
            if !matches!(&evidence.owner, EvidenceOwner::Component { path } if path == &instance.component)
            {
                continue;
            }
            for (side, references) in [
                (ReviewSide::Before, &input.resources.before.references),
                (ReviewSide::After, &input.resources.after.references),
            ] {
                for reference in references {
                    let path = if side == ReviewSide::Before {
                        input
                            .resources
                            .aliases
                            .get(&reference.path)
                            .unwrap_or(&reference.path)
                    } else {
                        &reference.path
                    };
                    let owner = match &reference.owner {
                        EvidenceOwner::Component { path } if side == ReviewSide::Before => {
                            mapped(path, input.paths)
                        }
                        EvidenceOwner::Component { path } => path.clone(),
                        _ => continue,
                    };
                    if path == &evidence.path
                        && owner == instance.component
                        && reference.instance_key.as_ref() == Some(&instance.key)
                    {
                        output.push(proof(
                            EntryChangeReason::Dependency {
                                path: evidence.path.clone(),
                            },
                            Some((side, reference.clone())),
                        ));
                    }
                }
            }
        }
    }
    output
}
