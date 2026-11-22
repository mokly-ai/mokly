//! Completion records publish only changed details and keep document keys intact.
//! A detail that only gains its settled workspace shares the usage record that equals it.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::namespace::viewer;
use mokly_model::public_detail::{EntryDetailV4, Workspace};
use mokly_model::usage::CatalogueUsage;
use mokly_model::{projection, projection_usage};

use crate::detail_encoding::DetailEncoder;
use crate::detail_publication::{PublicationKind, equivalent_with};
use crate::error::Result;
use crate::revision::RevisionLease;
use crate::revision_file::RevisionFile;
use crate::snapshot::{Snapshot, encode_index};

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
    let mut next = current.clone();
    let mut written = BTreeSet::new();
    for (view, usage) in changed {
        if write_usage(&mut next, view, usage) {
            written.insert(view.path.clone());
        }
        let completion = if matches!(usage, CatalogueUsage::Ready { .. }) {
            Completion::Ready
        } else {
            Completion::Unavailable
        };
        next.completed.insert(view.route.clone(), completion);
    }
    let mut shared = BTreeMap::new();
    if next.changes.is_none()
        && next.completed.len() == next.views.len()
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
            if let Some(record) = write_workspace(&mut next, current, &path, workspace) {
                shared.insert(path.clone(), record);
            }
            written.insert(path);
        }
    }
    let dirty = changed_paths(&mut next, current, written, &shared);
    if dirty.is_empty() {
        return Ok(Some(Arc::new(next)));
    }
    let Some(revision) = current.index.revision.checked_add(1) else {
        return Ok(None);
    };
    next.lease = Arc::new(RevisionLease::default());
    next.index.revision = revision;
    for path in &dirty {
        let route = viewer(&format!("entries/{path}.json"));
        let file = if let Some((record, file)) = shared.remove(path) {
            next.details.insert(path.clone(), record);
            file
        } else if let Some(detail) = next.details.get_mut(path) {
            Arc::make_mut(detail).revision = Some(revision);
            let adjacent = current.details.get(path).zip(current.files.get(&route));
            next.recent_details
                .publish(PublicationKind::Usage, detail, adjacent, encoder)?
        } else {
            continue;
        };
        if let Some(detail) = next.details.get(path) {
            projection::set_detail_id(&mut next.index, path, &detail.detail_id);
        }
        next.files.insert(route, file);
    }
    let index_file = encode_index(&next.index);
    next.files
        .insert(viewer("index.json"), RevisionFile::new(index_file));
    Ok(Some(Arc::new(next)))
}

/// Write one view's usage, and copy the detail only when the value changes.
/// Return whether the detail has the view.
fn write_usage(next: &mut Snapshot, view: &RenderRoute, usage: &CatalogueUsage) -> bool {
    let Some(detail) = next.details.get_mut(&view.path) else {
        return false;
    };
    let Some(index) = detail.views.iter().position(|candidate| {
        Some(candidate.viewport) == view.viewport && candidate.color_scheme == view.color_scheme
    }) else {
        return false;
    };
    if detail.views[index].usage != *usage {
        Arc::make_mut(detail).views[index].usage = usage.clone();
    }
    true
}

/// Write a settled workspace, and copy the detail only when the value changes.
/// A detail that still holds its origin's value instead returns the usage record of its path
/// when that record equals the detail with this workspace.
fn write_workspace(
    next: &mut Snapshot,
    current: &Snapshot,
    path: &str,
    workspace: Workspace,
) -> Option<(Arc<EntryDetailV4>, RevisionFile)> {
    let detail = next.details.get_mut(path)?;
    if detail.workspace.as_ref() == Some(&workspace) {
        return None;
    }
    let origin = current
        .details
        .get(path)
        .is_some_and(|previous| Arc::ptr_eq(previous, detail));
    if origin
        && let Some((record, file)) = next
            .recent_details
            .record(&detail.entry.path, PublicationKind::Usage)
        && equivalent_with(detail, Some(&workspace), record)
    {
        return Some((record.clone(), file.clone()));
    }
    Arc::make_mut(detail).workspace = Some(workspace);
    None
}

/// Keep the written paths whose detail changed, and restore the origin's value where the
/// written values left the detail equal to it. A shared record always changes its path.
fn changed_paths(
    next: &mut Snapshot,
    current: &Snapshot,
    written: BTreeSet<String>,
    shared: &BTreeMap<String, (Arc<EntryDetailV4>, RevisionFile)>,
) -> BTreeSet<String> {
    written
        .into_iter()
        .filter(|path| {
            if shared.contains_key(path) {
                return true;
            }
            let Some(detail) = next.details.get_mut(path) else {
                return false;
            };
            if let Some(previous) = current.details.get(path)
                && (Arc::ptr_eq(detail, previous) || **detail == **previous)
            {
                *detail = previous.clone();
                false
            } else {
                true
            }
        })
        .collect()
}
