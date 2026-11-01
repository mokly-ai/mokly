//! Explicit public record field selection and non-ready comparison states.

use crate::catalogue::{ModelEntry, VisualEntry};
use crate::projection::ViewKey;
use crate::public_metadata::{
    CatalogueChanges, CatalogueDetails, CatalogueEntry, ChangesStatus, ComparisonSelection,
};
use crate::public_records::{CatalogueView, CatalogueVisual};
use crate::wire_props;

pub(crate) fn comparison(status: ChangesStatus) -> ComparisonSelection {
    match status {
        ChangesStatus::Preparing => ComparisonSelection::Preparing,
        ChangesStatus::Pending => ComparisonSelection::Pending,
        ChangesStatus::Disabled => ComparisonSelection::Disabled,
        _ => ComparisonSelection::Unavailable,
    }
}

pub(crate) fn metadata(entry: &ModelEntry, status: ChangesStatus) -> CatalogueEntry {
    let metadata = &entry.metadata;
    CatalogueEntry {
        path: metadata.path.clone(),
        detail_id: String::new(),
        previous_path: None,
        title: metadata.title.clone(),
        tags: metadata.tags.clone(),
        details: CatalogueDetails {
            description: metadata.description.clone(),
            rationale: metadata.rationale.clone(),
            related_docs: metadata.related_docs.clone(),
            source_path: metadata.source.path.clone(),
        },
        changes: match status {
            ChangesStatus::Preparing => CatalogueChanges::Preparing,
            ChangesStatus::Pending => CatalogueChanges::Pending,
            ChangesStatus::Disabled => CatalogueChanges::Disabled,
            _ => CatalogueChanges::Unavailable,
        },
    }
}

pub(crate) fn visual(
    visual: &VisualEntry,
    keys: &[&ViewKey],
    status: ChangesStatus,
) -> CatalogueVisual {
    let mut views: Vec<_> = keys
        .iter()
        .filter_map(|key| {
            key.viewport.map(|viewport| CatalogueView {
                viewport,
                color_scheme: key.color_scheme,
                comparison: comparison(status),
                document_key: key.key.clone(),
            })
        })
        .collect();
    views.sort_by_key(|view| (view.viewport, view.color_scheme));
    CatalogueVisual {
        color_schemes: visual.color_schemes.clone(),
        prop_schema: visual.prop_schema.clone(),
        props: wire_props::encode(&visual.props),
        controls: visual.controls.clone(),
        views,
    }
}
