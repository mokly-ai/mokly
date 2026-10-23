//! Match the viewer's ready component and per-view eligibility contract.

use crate::public_index::CatalogueReadModel;
use crate::public_metadata::{ChangeKind, ComparisonSelection};
use crate::public_records::{CatalogueComponent, CatalogueRecord, CatalogueVisual};
use crate::public_validation::invalid;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;

pub(crate) fn validate(index: &CatalogueReadModel) -> Result<(), ReadError> {
    for entry in &index.screens {
        views(&entry.visual, false)?;
    }
    for entry in &index.components {
        component(entry)?;
    }
    for removed in &index.removed_entries {
        match &removed.entry {
            CatalogueRecord::Screen(entry) => views(&entry.visual, false)?,
            CatalogueRecord::Component(entry) => component(entry)?,
            _ => {}
        }
    }
    Ok(())
}

fn component(entry: &CatalogueComponent) -> Result<(), ReadError> {
    if let ComparisonSelection::Ready { kind, eligible } = entry.comparison
        && eligible != matches!(kind, ChangeKind::Changed | ChangeKind::Removed)
    {
        return Err(invalid(ContractViolation::ComponentComparisonEligibility));
    }
    views(&entry.visual, true)
}

fn views(visual: &CatalogueVisual, component: bool) -> Result<(), ReadError> {
    for view in &visual.views {
        if let ComparisonSelection::Ready { kind, eligible } = view.comparison
            && eligible
                != (kind == ChangeKind::Changed || (component && kind == ChangeKind::Removed))
        {
            return Err(invalid(ContractViolation::ComparisonEligibility));
        }
    }
    Ok(())
}
