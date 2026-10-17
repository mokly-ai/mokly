//! Direct entry membership and aggregate states use one owner-aware reason policy.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::catalogue::{CatalogueModel, EntryContent};
use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::{EntryChangeReason, ReviewState};

use crate::comparison_types::EntryClassification;
use crate::comparison_views::PairViews;
use crate::entry_metadata;
use crate::error::{InternalError, Result};
use crate::move_types::EntryPair;

pub(crate) fn classify(
    pair: &EntryPair,
    views: PairViews,
    before: &CatalogueModel,
    after: &CatalogueModel,
    paths: &BTreeMap<String, String>,
) -> Result<EntryClassification> {
    let previous = pair.before.map(|index| &before.entries[index]);
    let current = pair.after.map(|index| &after.entries[index]);
    let Some(entry) = current.or(previous) else {
        return Err(InternalError::EmptyPair.into());
    };
    let mut reasons = Vec::new();
    match (previous, current) {
        (None, _) => reasons.push(EntryChangeReason::Added),
        (_, None) => reasons.push(EntryChangeReason::Removed),
        (Some(previous), Some(current)) => {
            if entry_metadata::projection(previous, before, paths)?
                != entry_metadata::projection(current, after, &BTreeMap::new())?
            {
                reasons.push(EntryChangeReason::Metadata);
            }
            if views.views.iter().any(|view| view.material) {
                reasons.push(EntryChangeReason::Material);
            }
            if views.views.iter().any(|view| view.inputs) {
                reasons.push(EntryChangeReason::Inputs);
            }
            if views.views.iter().any(|view| view.structure) {
                reasons.push(EntryChangeReason::Structure);
            }
            let own_component =
                matches!(entry.content, EntryContent::Component { .. }).then(|| {
                    entry
                        .metadata
                        .variant_of
                        .as_ref()
                        .unwrap_or(&entry.metadata.path)
                });
            let mut dependencies = BTreeSet::new();
            for view in &views.views {
                for rule in &view.document.evidence.rules {
                    if rule.status != RuleStatus::Excluded && owned(&rule.owner, own_component) {
                        dependencies.insert(rule.stylesheet.clone());
                    }
                }
                for resource in &view.document.evidence.resources {
                    if owned(&resource.owner, own_component) {
                        dependencies.insert(resource.path.clone());
                    }
                }
            }
            reasons.extend(
                dependencies
                    .into_iter()
                    .map(|path| EntryChangeReason::Dependency { path }),
            );
        }
    }
    let state = if previous.is_none() {
        ReviewState::Added
    } else if current.is_none() {
        ReviewState::Removed
    } else {
        ReviewState::aggregate(views.views.iter().map(|view| view.document.state))
    };
    Ok(EntryClassification {
        kind: entry.content.kind(),
        path: entry.metadata.path.clone(),
        previous_path: pair
            .moved
            .then(|| previous.map_or(String::new(), |entry| entry.metadata.path.clone())),
        included: !reasons.is_empty() || pair.moved,
        state,
        reasons,
        documents: views.views.into_iter().map(|view| view.document).collect(),
    })
}

fn owned(owner: &EvidenceOwner, own_component: Option<&String>) -> bool {
    owner == &EvidenceOwner::Entry
        || matches!(owner, EvidenceOwner::Component { path } if Some(path) == own_component)
}
