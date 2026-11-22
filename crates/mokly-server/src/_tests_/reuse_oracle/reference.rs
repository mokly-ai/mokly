//! The publication paths of commit a0bb2fc56, which rebuild and compare every detail.
//! They stay here, outside product code, as the reference of the detail sharing oracle.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_index, projection_removed, projection_workspace};
use mokly_model::axes::EntryKind;
use mokly_model::namespace::viewer;
use mokly_model::nullable::Nullable;
use mokly_model::projection::{self, Publication};
use mokly_model::public_detail::EntryDetailV4;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::review::{ReviewEntry, ReviewEntryAddress, ReviewKind};
use mokly_model::usage::CatalogueUsage;
use mokly_model::{projection_usage, review_order, routes};

use crate::changes::Accepted;
use crate::comparison_metadata::{self, compared};
use crate::detail_encoding::EncodedDetails;
use crate::detail_publication::PublicationKind;
use crate::error::Result;
use crate::evidence::Completion;
use crate::revision::RevisionLease;
use crate::revision_file::RevisionFile;
use crate::snapshot::{Snapshot, encode_index};

pub(super) fn complete(
    current: &Snapshot,
    updates: &[(String, CatalogueUsage)],
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
            if let Some(detail) = next.details.get_mut(&path) {
                Arc::make_mut(detail).workspace = Some(workspace);
                dirty.insert(path);
            }
        }
    }
    dirty.retain(|path| {
        let Some(detail) = next.details.get_mut(path) else {
            return false;
        };
        if let Some(previous) = current.details.get(path)
            && **detail == **previous
        {
            *detail = previous.clone();
            false
        } else {
            true
        }
    });
    if dirty.is_empty() {
        return Ok(Some(Arc::new(next)));
    }
    let Some(revision) = current.index.revision.checked_add(1) else {
        return Ok(None);
    };
    next.lease = Arc::new(RevisionLease::default());
    next.index.revision = revision;
    for path in &dirty {
        if let Some(detail) = next.details.get_mut(path) {
            Arc::make_mut(detail).revision = Some(revision);
            let route = viewer(&format!("entries/{path}.json"));
            let adjacent = current.details.get(path).zip(current.files.get(&route));
            let file = next.recent_details.publish(
                PublicationKind::Usage,
                detail,
                adjacent,
                &EncodedDetails,
            )?;
            projection::set_detail_id(&mut next.index, path, &detail.detail_id);
            next.files.insert(route, file);
        }
    }
    let index_file = encode_index(&next.index);
    next.files
        .insert(viewer("index.json"), RevisionFile::new(index_file));
    Ok(Some(Arc::new(next)))
}

pub(super) fn project(
    current: &Snapshot,
    status: ChangesStatus,
    accepted: Option<Arc<Accepted>>,
) -> Result<Arc<Snapshot>> {
    let mut next = current.clone();
    next.index.revision += 1;
    next.lease = Arc::new(RevisionLease::default());
    next.changes = accepted;
    next.index = projection::index(
        &current.model,
        &current.view_keys,
        &Publication {
            config_path: current.config_path.clone(),
            deployment_id: current.index.deployment_id.clone(),
            revision: next.index.revision,
            base: current.index.base.clone(),
            changes_status: status,
            live_generation: current
                .index
                .live
                .as_ref()
                .map(|live| live.generation.clone()),
        },
    );
    next.index.identity = current.index.identity.clone();
    if let Some(accepted) = &next.changes {
        projection_index::apply(&mut next.index, &accepted.result);
        let historical = comparison_metadata::base(accepted, current);
        next.index.removed_entries = projection_removed::records(&accepted.result, historical);
        let ids = comparison_metadata::detail_ids(accepted, current)?;
        for record in &mut next.index.removed_entries {
            if let Some(id) = ids.get(record.entry.path()) {
                record.entry.set_detail_id(id);
            }
        }
        next.index.comparison_url = Nullable(Some(routes::comparison_generation(&accepted.id)));
    }
    compose(&mut next)?;
    let kind = if next.changes.is_some() {
        PublicationKind::ChangesEvidence
    } else {
        PublicationKind::ChangesStatus
    };
    for (path, detail) in &mut next.details {
        Arc::make_mut(detail).revision = Some(next.index.revision);
        let route = viewer(&format!("entries/{path}.json"));
        let adjacent = current.details.get(path).zip(current.files.get(&route));
        let file = next
            .recent_details
            .publish(kind, detail, adjacent, &EncodedDetails)?;
        projection::set_detail_id(&mut next.index, path, &detail.detail_id);
        next.files.insert(route, file);
    }
    next.files.insert(
        viewer("index.json"),
        RevisionFile::new(encode_index(&next.index)),
    );
    Ok(Arc::new(next))
}

fn compose(next: &mut Snapshot) -> Result<()> {
    let mut details: BTreeMap<_, _> = next
        .details
        .iter()
        .map(|(path, detail)| {
            let mut detail = (**detail).clone();
            for view in &mut detail.views {
                view.state = None;
                view.ignored_ids = None;
                view.resource_evidence = None;
            }
            detail.resource_evidence = None;
            detail.reasons = None;
            detail.before = None;
            detail.workspace = None;
            (path.clone(), detail)
        })
        .collect();
    let references = details
        .iter()
        .map(|(path, detail)| (path.clone(), detail))
        .collect();
    for (path, workspace) in projection_usage::workspaces(&references, &next.index) {
        if let Some(detail) = details.get_mut(&path) {
            detail.workspace = Some(workspace);
        }
    }
    if let Some(accepted) = &next.changes {
        apply_evidence(&mut details, &accepted.result);
        compared(projection_workspace::apply(&mut details, &accepted.result))?;
    }
    next.details = details
        .into_iter()
        .map(|(path, detail)| (path, Arc::new(detail)))
        .collect();
    Ok(())
}

fn apply_evidence(details: &mut BTreeMap<String, EntryDetailV4>, result: &ComparisonResult) {
    let bases = base_addresses(&result.review.entries);
    for entry in &result.entries {
        let Some(detail) = details
            .get_mut(&entry.path)
            .filter(|detail| detail.entry.kind == entry.kind)
        else {
            continue;
        };
        detail.reasons = entry.included.then(|| {
            let mut reasons = entry.reasons.clone();
            review_order::normalize_reasons(&mut reasons);
            reasons
        });
        if detail.revision.is_some() {
            detail.before = bases.get(&(entry.kind, entry.path.as_str())).cloned();
        }
        for document in &entry.documents {
            if let Some(view) = detail.views.iter_mut().find(|view| {
                Some(view.viewport) == document.key.viewport
                    && view.color_scheme == document.key.color_scheme
            }) {
                view.state = Some(document.state);
                view.ignored_ids = Some(document.ignored_ids.clone());
                view.resource_evidence = Some(document.evidence.clone());
            }
            if entry.kind == EntryKind::Page {
                detail.resource_evidence = Some(document.evidence.clone());
            }
        }
    }
}

fn base_addresses(entries: &[ReviewEntry]) -> BTreeMap<(EntryKind, &str), ReviewEntryAddress> {
    entries
        .iter()
        .flat_map(|entry| std::iter::once(entry).chain(entry.variants.iter().flatten()))
        .filter(|entry| entry.after.is_some())
        .filter_map(|entry| {
            let kind = match entry.kind {
                ReviewKind::Screen => EntryKind::Screen,
                ReviewKind::Component => EntryKind::Component,
                ReviewKind::UseCase => return None,
            };
            entry
                .before
                .clone()
                .map(|before| ((kind, entry.path.as_str()), before))
        })
        .collect()
}
