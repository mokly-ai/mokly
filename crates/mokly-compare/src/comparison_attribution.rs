//! Apply shared CSS reduction and unchanged-input implementation proof to each view.

use std::collections::BTreeSet;
use std::mem;

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
    view.rule_sources = input
        .attributed
        .own_page_sources
        .get(&input.index)
        .cloned()
        .unwrap_or_default();
    instance_proofs.append(&mut view.proofs);
    instance_proofs.extend(mem::take(&mut view.owned).proofs(&input.attributed.own_pages));
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
        for stylesheet in &view.rule_sources {
            impact.insert(component.into());
            own_impact
                .dependencies
                .insert((component.into(), stylesheet.clone()));
        }
    }
    view.rule_sources.extend(
        view.document
            .evidence
            .rules
            .iter()
            .filter(|rule| {
                rule.status != RuleStatus::Excluded && rule.owner == EvidenceOwner::Entry
            })
            .map(|rule| rule.stylesheet.clone()),
    );
    let direct = !view.rule_sources.is_empty()
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

#[cfg(test)]
#[path = "_tests_/own_rule_sources_tests.rs"]
mod own_rule_sources_tests;
