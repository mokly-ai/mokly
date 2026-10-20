//! Apply shared CSS reduction and unchanged-input implementation proof to each view.

use std::collections::BTreeSet;

use mokly_css::attribution::Attribution;
use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::ReviewState;

use crate::comparison_views::PendingView;
use crate::implementation::OwnImpact;
use crate::instance_proof::InstanceProof;

pub(crate) struct ViewInput<'a> {
    pub(crate) attributed: &'a Attribution,
    pub(crate) index: usize,
    pub(crate) component: Option<&'a str>,
    pub(crate) same_inputs: bool,
}

pub(crate) fn apply(
    view: &mut PendingView,
    input: ViewInput<'_>,
    impact: &mut BTreeSet<String>,
    own_impact: &mut OwnImpact,
    instance_proofs: &mut Vec<InstanceProof>,
) {
    view.document.evidence.rules = input.attributed.pages[input.index].clone();
    instance_proofs.append(&mut view.proofs);
    instance_proofs.extend(view.owned.proofs(&input.attributed.own_pages));
    if let Some(component) = input.component
        && input.same_inputs
    {
        if view.root_changed {
            impact.insert(component.into());
            own_impact.render.insert(component.into());
        }
        for resource in &view.document.evidence.resources {
            if matches!(&resource.owner, EvidenceOwner::Component { path } if path == component) {
                impact.insert(component.into());
                own_impact
                    .dependencies
                    .insert((component.into(), resource.path.clone()));
            }
        }
        for rule in &view.document.evidence.rules {
            if rule.status != RuleStatus::Excluded
                && matches!(&rule.owner, EvidenceOwner::Component { path } if path == component)
            {
                impact.insert(component.into());
                own_impact
                    .dependencies
                    .insert((component.into(), rule.stylesheet.clone()));
            }
        }
    }
    let direct =
        input.attributed.component_pages.contains(&input.index)
            || view.document.evidence.rules.iter().any(|rule| {
                rule.status != RuleStatus::Excluded && owned(&rule.owner, input.component)
            })
            || view
                .document
                .evidence
                .resources
                .iter()
                .any(|resource| owned(&resource.owner, input.component));
    if direct
        && matches!(
            view.document.state,
            ReviewState::Unchanged | ReviewState::IgnoredOnly
        )
    {
        view.document.state = ReviewState::Changed;
    }
}

fn owned(owner: &EvidenceOwner, component: Option<&str>) -> bool {
    owner == &EvidenceOwner::Entry
        || matches!(owner, EvidenceOwner::Component { path } if Some(path.as_str()) == component)
}
