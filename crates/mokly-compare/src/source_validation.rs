//! Validate source coverage and affected proof against the recorded classifier inputs.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::axes::EntryKind;
use mokly_model::canonical;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::read_contract::ContractViolation;
use mokly_model::readers::ReadError;
use mokly_model::review::{ReviewEntry, ReviewKind, ReviewResultV8};
use mokly_model::{review_order, review_validation};

use crate::affected;
use crate::comparison_error::CompareResult;
use crate::comparison_types::EntryClassification;
use crate::comparison_views::{UsageView, address};
use crate::error::{Error, Result};
use crate::impact_validation;
use crate::instance_proof::InstanceProof;
use crate::move_types::Pairing;

pub(crate) struct SourceValidation<'a> {
    pub(crate) before: &'a CatalogueModel,
    pub(crate) after: &'a CatalogueModel,
    pub(crate) pairing: &'a Pairing,
    pub(crate) classifications: &'a [EntryClassification],
    pub(crate) usage: &'a [UsageView],
    pub(crate) impact: &'a BTreeSet<String>,
    pub(crate) instance_proofs: &'a [InstanceProof],
}

/// Validate the complete result before any host can project or capture it.
pub(crate) fn validate(result: &ReviewResultV8, inputs: SourceValidation<'_>) -> Result<usize> {
    review_validation::validate(result).compare()?;
    let entries: Vec<_> = result
        .entries
        .iter()
        .chain(
            result
                .entries
                .iter()
                .flat_map(|entry| entry.variants.iter().flatten()),
        )
        .collect();
    let index: BTreeMap<_, _> = entries
        .iter()
        .map(|entry| ((entry.kind, entry.path.as_str()), *entry))
        .collect();
    let mut lookups = 0;
    impact_validation::validate(&inputs)?;
    let expected = inputs
        .pairing
        .entries
        .iter()
        .filter(|pair| {
            pair.after
                .map(|index| &inputs.after.entries[index])
                .or_else(|| pair.before.map(|index| &inputs.before.entries[index]))
                .is_some_and(|entry| {
                    matches!(
                        entry.content.kind(),
                        EntryKind::Screen | EntryKind::Component | EntryKind::UseCase
                    )
                })
        })
        .count();
    if entries.len() != expected {
        return Err(invalid());
    }
    for (pair, classification) in inputs.pairing.entries.iter().zip(inputs.classifications) {
        let kind = match classification.kind {
            EntryKind::Screen => ReviewKind::Screen,
            EntryKind::Component => ReviewKind::Component,
            EntryKind::UseCase => ReviewKind::UseCase,
            _ => continue,
        };
        lookups += 1;
        let Some(entry) = index.get(&(kind, classification.path.as_str())) else {
            return Err(invalid());
        };
        let before = pair
            .before
            .map(|index| address(&inputs.before.entries[index]));
        let after = pair
            .after
            .map(|index| address(&inputs.after.entries[index]));
        if canonical::to_string(&entry.before).compare()?
            != canonical::to_string(&before).compare()?
            || canonical::to_string(&entry.after).compare()?
                != canonical::to_string(&after).compare()?
            || entry.previous_path != classification.previous_path
            || entry.included != classification.included
            || !reasons_equal(entry, classification)
            || entry.views.len() != classification.documents.len()
        {
            return Err(invalid());
        }
        for (view, document) in entry.views.iter().zip(&classification.documents) {
            if Some(view.viewport) != document.key.viewport
                || view.color_scheme != document.key.color_scheme
                || view.state != document.state
                || view.ignored_ids != document.ignored_ids
                || view.rules != document.evidence.rules
                || view.resources != document.evidence.resources
            {
                return Err(invalid());
            }
        }
    }
    let mut expected = ReviewResultV8 {
        schema_version: 8,
        base_commit: result.base_commit.clone(),
        entries: Vec::new(),
        affected: affected::collect(
            inputs.usage,
            inputs.impact,
            inputs.pairing,
            inputs.before,
            inputs.after,
        )
        .0,
        diagnostics: Vec::new(),
    };
    review_order::normalize(&mut expected).compare()?;
    if canonical::to_string(&expected.affected).compare()?
        != canonical::to_string(&result.affected).compare()?
    {
        return Err(invalid());
    }
    Ok(lookups)
}

fn reasons_equal(entry: &ReviewEntry, classification: &EntryClassification) -> bool {
    let mut expected = classification.reasons.clone();
    expected.sort_by(|left, right| {
        review_order::reason_key(left).cmp(&review_order::reason_key(right))
    });
    expected.dedup();
    entry.reasons == expected
}

pub(crate) fn invalid() -> Error {
    Error::Review {
        source: ReadError::Contract {
            boundary: "review result sources",
            message: ContractViolation::Review,
        },
    }
}
