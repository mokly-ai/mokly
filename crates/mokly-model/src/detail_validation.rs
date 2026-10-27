//! Structural detail rules and canonical decoding of recorded input props.

use std::collections::BTreeSet;

use crate::axes::EntryKind;
use crate::canonical::compare_utf16;
use crate::paths::is_entry_path;
use crate::public_detail::EntryDetailV3;
use crate::public_validation::hash;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;
use crate::review_order::reason_key;
use crate::review_validation::ignore_id;
use crate::usage::CatalogueUsage;
use crate::wire_decode;

pub(crate) fn validate(detail: &EntryDetailV3) -> Result<(), ReadError> {
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
    if removed && visual {
        let Some(workspace) = detail.workspace.as_ref() else {
            return Err(invalid(ContractViolation::Workspace));
        };
        if workspace.used_by.is_none() || workspace.affected.is_none() {
            return Err(invalid(ContractViolation::Workspace));
        }
    }
    if visual != detail.control_order.is_some()
        || detail
            .control_order
            .as_ref()
            .is_some_and(|order| order.iter().collect::<BTreeSet<_>>().len() != order.len())
    {
        return Err(invalid(ContractViolation::ControlOrder));
    }
    if detail.entry.kind != EntryKind::Page && detail.resource_evidence.is_some() {
        return Err(invalid(ContractViolation::DetailEvidence));
    }
    comparison(detail, current && visual)?;
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

/// View states and ignore ids travel with view evidence; `before` names a current visual entry's base side.
fn comparison(detail: &EntryDetailV3, current_visual: bool) -> Result<(), ReadError> {
    let views = detail.views.iter().all(|view| {
        let ready = view.resource_evidence.is_some();
        view.state.is_some() == ready
            && view.ignored_ids.as_ref().is_none_or(|ids| {
                ids.iter().all(|id| ignore_id(id))
                    && ids
                        .windows(2)
                        .all(|pair| compare_utf16(&pair[0], &pair[1]).is_lt())
            })
            && view.ignored_ids.is_some() == ready
    });
    let before = detail.before.as_ref().is_none_or(|before| {
        current_visual
            && is_entry_path(&before.path)
            && before
                .props
                .as_ref()
                .is_none_or(|props| wire_decode::decode(props).is_ok())
            && (detail.entry.kind == EntryKind::Component || before.supplied_slots.is_none())
    });
    if views && before {
        Ok(())
    } else {
        Err(invalid(ContractViolation::DetailComparison))
    }
}

fn invalid(message: ContractViolation) -> ReadError {
    ReadError::Contract {
        boundary: "entry detail",
        message,
    }
}
