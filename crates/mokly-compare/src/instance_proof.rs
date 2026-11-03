//! Exact unchanged-input instance and reference evidence, separate from own view states.

use std::collections::BTreeMap;

use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::review::EntryChangeReason;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_resources::Resources;
use crate::material::mapped;
use crate::view_material::MaterialComparison;

/// Component impact from an exact paired instance or its reached resource.
pub(crate) struct InstanceProof {
    pub(crate) component: String,
    pub(crate) reason: EntryChangeReason,
}

pub(crate) struct ProofInput<'a> {
    pub(crate) comparison: &'a MaterialComparison,
    pub(crate) resources: &'a Resources,
    pub(crate) evidence: &'a [ResourceEvidence],
    pub(crate) paths: &'a BTreeMap<String, String>,
}

pub(crate) fn collect(input: ProofInput<'_>) -> Vec<InstanceProof> {
    let mut output = Vec::new();
    for instance in &input.comparison.instances {
        let proof = |reason| InstanceProof {
            component: instance.component.clone(),
            reason,
        };
        if instance.render_changed {
            output.push(proof(EntryChangeReason::Implementation));
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
                        output.push(proof(EntryChangeReason::Dependency {
                            path: evidence.path.clone(),
                        }));
                    }
                }
            }
        }
    }
    output
}
