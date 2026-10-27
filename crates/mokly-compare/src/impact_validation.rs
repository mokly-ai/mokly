//! Admit external implementation reasons only from exact recorded view and instance proof.

use std::collections::{BTreeMap, BTreeSet};

use mokly_graph::urls::local_target;
use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::EntryChangeReason;
use mokly_model::review_affected::ReviewSide;
use mokly_model::review_order::reason_key;
use mokly_model::usage::CatalogueUsage;

use crate::error::Result;
use crate::material::mapped;
use crate::source_validation::{SourceValidation, invalid};

/// Checks each instance proof against both sides' recorded usage and the
/// after-side view evidence. An `implementation` reason then needs an instance
/// proof, and a `dependency` reason needs an instance proof or a rule or
/// resource record that the entry owns. It reads only the recorded classifier
/// inputs, never the result's own rows, so a result cannot prove itself.
pub(crate) fn validate(input: &SourceValidation<'_>) -> Result<()> {
    let paths = input.pairing.paths(input.before, input.after);
    let mut instances = BTreeMap::new();
    for view in input.usage {
        if let CatalogueUsage::Ready {
            instances: usage, ..
        } = &view.usage
        {
            for instance in usage {
                instances.insert(
                    (
                        view.side,
                        view.entry.path.as_str(),
                        view.key,
                        instance.key.as_str(),
                    ),
                    instance,
                );
            }
        }
    }
    let documents: BTreeMap<_, _> = input
        .classifications
        .iter()
        .flat_map(|entry| {
            entry
                .documents
                .iter()
                .map(|view| ((entry.path.as_str(), view.key), view))
        })
        .collect();
    for proof in input.instance_proofs {
        let before = instances.get(&(
            ReviewSide::Before,
            proof.before.path.as_str(),
            proof.view,
            proof.instance.as_str(),
        ));
        let after = instances.get(&(
            ReviewSide::After,
            proof.after.path.as_str(),
            proof.view,
            proof.instance.as_str(),
        ));
        let (Some(before), Some(after)) = (before, after) else {
            return Err(invalid());
        };
        if before.props_key != after.props_key
            || mapped(&before.component_id, &paths) != proof.component
            || after.component_id != proof.component
        {
            return Err(invalid());
        }
        match (&proof.reason, &proof.reference) {
            (EntryChangeReason::Implementation, None) => {}
            (EntryChangeReason::Dependency { path }, Some((side, reference))) => {
                let owner = match &reference.owner {
                    EvidenceOwner::Component { path } if *side == ReviewSide::Before => {
                        mapped(path, &paths)
                    }
                    EvidenceOwner::Component { path } => path.clone(),
                    _ => return Err(invalid()),
                };
                if reference.instance_key.as_ref() != Some(&proof.instance) || owner != proof.component
                    || local_target(&reference.source, &reference.url).ok().flatten().as_ref() != Some(&reference.path)
                    || !documents.get(&(proof.after.path.as_str(), proof.view)).is_some_and(|view| view.evidence.resources.iter().any(|record| &record.path == path && matches!(&record.owner, EvidenceOwner::Component { path } if path == &proof.component))) {
                    return Err(invalid());
                }
            }
            _ => return Err(invalid()),
        }
    }
    let mut external = BTreeSet::new();
    for proof in input.instance_proofs {
        let (kind, path) = reason_key(&proof.reason);
        external.insert((proof.component.as_str(), kind, path));
    }
    let owners: BTreeMap<_, _> = input
        .before
        .entries
        .iter()
        .chain(&input.after.entries)
        .map(|entry| {
            (
                entry.metadata.path.as_str(),
                entry
                    .metadata
                    .variant_of
                    .as_deref()
                    .unwrap_or(&entry.metadata.path),
            )
        })
        .collect();
    for entry in input.classifications {
        let owner = owners
            .get(entry.path.as_str())
            .copied()
            .unwrap_or(&entry.path);
        let owned = |evidence: &EvidenceOwner| {
            *evidence == EvidenceOwner::Entry
                || matches!(evidence, EvidenceOwner::Component { path } if mapped(path, &paths) == owner)
        };
        for reason in &entry.reasons {
            let (kind, path) = reason_key(reason);
            let external = external.contains(&(entry.path.as_str(), kind, path));
            match reason {
                EntryChangeReason::Implementation if !external => return Err(invalid()),
                EntryChangeReason::Dependency { path } => {
                    let own = entry.documents.iter().any(|view| {
                        view.evidence.rules.iter().any(|rule| {
                            &rule.stylesheet == path
                                && rule.status != RuleStatus::Excluded
                                && owned(&rule.owner)
                        }) || view
                            .evidence
                            .resources
                            .iter()
                            .any(|record| &record.path == path && owned(&record.owner))
                    });
                    if !own && !external {
                        return Err(invalid());
                    }
                }
                _ => {}
            }
        }
    }
    Ok(())
}
