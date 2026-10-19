//! Structural detail rules and canonical decoding of recorded input props.

use crate::axes::EntryKind;
use crate::canonical::compare_utf16;
use crate::paths::is_entry_path;
use crate::public_detail::EntryDetailV1;
use crate::public_validation::hash;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;
use crate::review_order::reason_key;
use crate::usage::CatalogueUsage;
use crate::wire_decode;

pub(crate) fn validate(detail: &EntryDetailV1) -> Result<(), ReadError> {
    let current = detail.deployment_id.is_some()
        && detail.revision.is_some()
        && detail.generation.is_none()
        && detail.entry.snapshot_id.is_none();
    let removed = detail.deployment_id.is_none()
        && detail.revision.is_none()
        && detail.generation.is_some()
        && detail.entry.snapshot_id.is_some();
    if !current && !removed {
        return Err(invalid(ContractViolation::DetailFence));
    }
    if !hash(&detail.identity.id)
        || detail.identity.title != "Mokly"
        || detail.deployment_id.as_deref().is_some_and(|id| !hash(id))
        || detail.generation.as_deref().is_some_and(|id| !hash(id))
        || detail
            .entry
            .snapshot_id
            .as_deref()
            .is_some_and(|id| !hash(id))
        || detail
            .revision
            .is_some_and(|revision| revision > 9_007_199_254_740_991)
    {
        return Err(invalid(ContractViolation::DetailIdentity));
    }
    if !is_entry_path(&detail.entry.path) {
        return Err(invalid(ContractViolation::DetailPath));
    }
    if detail.reasons.as_ref().is_some_and(|reasons| {
        reasons.windows(2).any(|pair| {
            let (left_kind, left_target) = reason_key(&pair[0]);
            let (right_kind, right_target) = reason_key(&pair[1]);
            !left_kind
                .cmp(right_kind)
                .then_with(|| compare_utf16(left_target, right_target))
                .is_lt()
        })
    }) {
        return Err(invalid(ContractViolation::DetailReasons));
    }
    let visual = matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component);
    if !visual && (!detail.views.is_empty() || detail.workspace.is_some()) {
        return Err(invalid(ContractViolation::DetailKind));
    }
    if detail.entry.kind != EntryKind::Page && detail.resource_evidence.is_some() {
        return Err(invalid(ContractViolation::DetailEvidence));
    }
    for view in &detail.views {
        if let CatalogueUsage::Ready { instances, .. } = &view.usage {
            for instance in instances {
                if wire_decode::decode(&instance.props).is_err() {
                    return Err(invalid(ContractViolation::UsageProps));
                }
            }
        }
    }
    for change in detail
        .workspace
        .iter()
        .flat_map(|workspace| &workspace.input_changes)
    {
        if wire_decode::decode(&change.before).is_err()
            || wire_decode::decode(&change.after).is_err()
        {
            return Err(invalid(ContractViolation::UsageProps));
        }
    }
    Ok(())
}

fn invalid(message: ContractViolation) -> ReadError {
    ReadError::Contract {
        boundary: "entry detail",
        message,
    }
}
