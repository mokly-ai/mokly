//! Usage completions replace one complete publication without changing document keys.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::namespace::viewer;
use mokly_model::projection_usage;
use mokly_model::usage::CatalogueUsage;
use mokly_model::usage_schemas::UsageSchemas;

use crate::error::Result;
use crate::revision::RevisionLease;
use crate::snapshot::{Snapshot, encode_detail, revision_index};

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
) -> Result<Option<Arc<Snapshot>>> {
    let routes: BTreeMap<_, _> = current
        .routes
        .iter()
        .map(|view| (view.route.as_str(), view))
        .collect();
    let changed: Vec<_> = updates
        .iter()
        .filter_map(|(route, usage)| {
            let view = routes.get(route.as_str())?;
            let completion = if matches!(usage, CatalogueUsage::Ready { .. }) {
                Completion::Ready
            } else {
                Completion::Unavailable
            };
            (current.completed.get(route) != Some(&completion))
                .then_some((*view, usage, completion))
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
    for (view, usage, completion) in changed {
        if let Some(viewport) = view.viewport
            && let Some(detail) = next.details.get_mut(&view.path)
            && let Some(detail_view) = detail.views.iter_mut().find(|candidate| {
                candidate.viewport == viewport && candidate.color_scheme == view.color_scheme
            })
        {
            detail_view.usage = usage.clone();
        }
        next.completed.insert(view.route.clone(), completion);
    }
    projection_usage::workspaces(&mut next.details, &next.index);
    let mut schemas = UsageSchemas::new(&next.index.components);
    next.files
        .insert(viewer("index.json"), revision_index(&next.index)?);
    for (path, detail) in &mut next.details {
        detail.revision = Some(revision);
        next.files.insert(
            viewer(&format!("entries/{path}.json")),
            encode_detail(detail, &next.index, &mut schemas)?,
        );
    }
    Ok(Some(Arc::new(next)))
}
