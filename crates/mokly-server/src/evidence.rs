//! Usage completions replace one complete publication without changing document keys.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::namespace::viewer;
use mokly_model::projection_usage;
use mokly_model::usage::CatalogueUsage;
use mokly_model::usage_schemas::UsageSchemas;

use crate::detail_encoding::DetailEncoder;
use crate::error::Result;
use crate::revision::RevisionLease;
use crate::snapshot::Snapshot;

/// A document's position and detail context in one immutable graph generation.
#[derive(Clone)]
pub struct RenderRoute {
    /// Generated path, without its public prefix.
    pub route: String,
    /// Canonical entry path.
    pub path: String,
    /// Visual axis, absent for pages and Markdown.
    pub viewport: Option<Viewport>,
    /// Effective color scheme.
    pub color_scheme: ColorScheme,
}

/// Completion state retains no duplicate usage records or rendered bytes.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Completion {
    /// The document produced ready usage.
    Ready,
    /// The render failed or supplied unavailable usage.
    Unavailable,
}

pub(crate) fn complete(
    current: &Snapshot,
    updates: &[(String, CatalogueUsage)],
    encoder: &dyn DetailEncoder,
) -> Result<Option<Arc<Snapshot>>> {
    let changed: Vec<_> = updates
        .iter()
        .filter_map(|(route, usage)| {
            let view = current.views.get(route)?;
            (!current.completed.contains_key(route)).then_some((view, usage))
        })
        .collect();
    if changed.is_empty() {
        return Ok(None);
    }
    let Some(revision) = current.index.revision.checked_add(1) else {
        return Ok(None);
    };
    let mut next = current.clone();
    next.lease = Arc::new(RevisionLease::default());
    next.index.revision = revision;
    let mut dirty = BTreeSet::new();
    for (view, usage) in changed {
        if let Some(detail) = next.details.get_mut(&view.path) {
            let detail = Arc::make_mut(detail);
            if let Some(detail_view) = detail.views.iter_mut().find(|candidate| {
                Some(candidate.viewport) == view.viewport
                    && candidate.color_scheme == view.color_scheme
            }) {
                detail_view.usage = usage.clone();
                dirty.insert(view.path.clone());
            }
        }
        let completion = if matches!(usage, CatalogueUsage::Ready { .. }) {
            Completion::Ready
        } else {
            Completion::Unavailable
        };
        next.completed.insert(view.route.clone(), completion);
    }
    if next.completed.len() == next.views.len()
        && next
            .completed
            .values()
            .all(|value| *value == Completion::Ready)
    {
        let details = next
            .details
            .iter()
            .map(|(path, detail)| (path.clone(), detail.as_ref()))
            .collect();
        for (path, workspace) in projection_usage::workspaces(&details, &next.index) {
            if let Some(detail) = next.details.get_mut(&path) {
                Arc::make_mut(detail).workspace = Some(workspace);
                dirty.insert(path);
            }
        }
    }
    let mut schemas = UsageSchemas::new(&next.index.components);
    for path in dirty {
        if let Some(detail) = next.details.get_mut(&path) {
            if let Some(previous) = current.details.get(&path)
                && **detail == **previous
            {
                *detail = previous.clone();
                continue;
            }
            let detail = Arc::make_mut(detail);
            detail.revision = Some(revision);
            next.files.insert(
                viewer(&format!("entries/{path}.json")),
                encoder.encode(detail, &next.index, &mut schemas)?,
            );
        }
    }
    Ok(Some(Arc::new(next)))
}
