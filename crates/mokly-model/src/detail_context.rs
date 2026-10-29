//! Context-aware current detail fences, exact view membership, and usage checks.

use std::collections::BTreeSet;

use crate::axes::EntryKind;
use crate::public_detail::EntryDetailV4;
use crate::public_index::CatalogueReadModel;
use crate::public_metadata::{CatalogueChanges, ChangeKind, ComparisonSelection};
use crate::read_contract::ContractViolation;
use crate::readers::{self, ReadError};
use crate::usage_context;
use crate::usage_schemas::UsageSchemas;

/// Decode and validate a current entry detail against the installed index.
/// Historical callers supply their base-side component schemas to `usage_context`.
pub fn read(text: &str, index: &CatalogueReadModel) -> Result<EntryDetailV4, ReadError> {
    let detail = readers::detail(text)?;
    validate(&detail, index)?;
    Ok(detail)
}

/// Validate the current fence, kind, view order, evidence readiness, and usage.
pub fn validate(detail: &EntryDetailV4, index: &CatalogueReadModel) -> Result<(), ReadError> {
    validate_with(detail, index, &mut UsageSchemas::new(&index.components))
}

/// Validate all usage against publication-local compiled schemas.
pub fn validate_with(
    detail: &EntryDetailV4,
    index: &CatalogueReadModel,
    schemas: &mut UsageSchemas<'_>,
) -> Result<(), ReadError> {
    if detail.identity.id != index.identity.id
        || detail.identity.title != index.identity.title
        || detail.revision != Some(index.revision)
        || detail.entry.snapshot_id.is_some()
    {
        return Err(invalid(ContractViolation::DetailFence));
    }
    let path = &detail.entry.path;
    let entry = match detail.entry.kind {
        EntryKind::Screen => index
            .screens
            .iter()
            .find(|entry| &entry.entry.path == path)
            .map(|entry| (&entry.entry, Some(&entry.visual))),
        EntryKind::Component => index
            .components
            .iter()
            .find(|entry| &entry.entry.path == path)
            .map(|entry| (&entry.entry, Some(&entry.visual))),
        EntryKind::Page => index
            .pages
            .iter()
            .find(|entry| &entry.entry.path == path)
            .map(|entry| (&entry.entry, None)),
        EntryKind::Document => index
            .documents
            .iter()
            .find(|entry| &entry.entry.path == path)
            .map(|entry| (&entry.entry, None)),
        EntryKind::UseCase => index
            .use_cases
            .iter()
            .find(|entry| &entry.entry.path == path)
            .map(|entry| (&entry.entry, None)),
    };
    let Some((entry, visual)) = entry else {
        return Err(invalid(ContractViolation::DetailKind));
    };
    if detail.detail_id != entry.detail_id {
        return Err(invalid(ContractViolation::DetailFence));
    }
    if let Some(workspace) = detail.workspace.as_ref() {
        let current_variant = detail.entry.kind == EntryKind::Component
            && index
                .components
                .iter()
                .find(|component| component.entry.path == *path)
                .is_some_and(|component| component.variant_of.is_some());
        if current_variant {
            if workspace.used_by.is_some() || workspace.affected.is_some() {
                return Err(invalid(ContractViolation::Workspace));
            }
        } else if workspace.used_by.is_none() || workspace.affected.is_none() {
            return Err(invalid(ContractViolation::Workspace));
        }
    }
    if detail.reasons.is_some()
        != matches!(
            entry.changes,
            CatalogueChanges::Ready { included: true, .. }
        )
    {
        return Err(invalid(ContractViolation::DetailReasonsPresence));
    }
    if detail.before.is_some()
        != (visual.is_some()
            && matches!(entry.changes, CatalogueChanges::Ready { kind, .. } if kind != ChangeKind::Added))
    {
        return Err(invalid(ContractViolation::DetailComparison));
    }
    if let Some(visual) = visual {
        let Some(order) = &detail.control_order else {
            return Err(invalid(ContractViolation::ControlOrder));
        };
        if order.len() != visual.controls.len()
            || order.iter().collect::<BTreeSet<_>>().len() != order.len()
            || order.iter().any(|key| !visual.controls.contains_key(key))
        {
            return Err(invalid(ContractViolation::ControlOrder));
        }
        if visual.views.len() != detail.views.len() {
            return Err(invalid(ContractViolation::Views));
        }
        for (view, expected) in detail.views.iter().zip(&visual.views) {
            if view.viewport != expected.viewport || view.color_scheme != expected.color_scheme {
                return Err(invalid(ContractViolation::Views));
            }
            if view.resource_evidence.is_some()
                != matches!(expected.comparison, ComparisonSelection::Ready { .. })
            {
                return Err(invalid(ContractViolation::DetailEvidence));
            }
            usage_context::validate_with(&view.usage, detail.entry.kind, schemas)?;
        }
    }
    Ok(())
}

pub(crate) fn invalid(message: ContractViolation) -> ReadError {
    ReadError::Contract {
        boundary: "entry detail",
        message,
    }
}

#[cfg(test)]
#[path = "_tests_/detail_context_tests.rs"]
mod detail_context_tests;

#[cfg(test)]
#[path = "_tests_/detail_reason_presence_tests.rs"]
mod detail_reason_presence_tests;
