//! Capture only requested view closures from the accepted immutable render handles.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::types::RenderGeneration;
use mokly_model::axes::EntryKind;
use mokly_model::review::{ReviewEntry, ReviewKind, ReviewResultV8};
use mokly_model::review_affected::ReviewSide;
use mokly_model::{namespace, readers, routes};

use crate::assets::{File, content_type};
use crate::changes::{Accepted, ChangeCancellation};
use crate::error::{InternalError, Result, ServerError};
use crate::snapshot::encode_review;

/// Maximum bytes in one immutable comparison generation.
pub const MAX_BYTES: usize = 64 * 1024 * 1024;

/// Blocking capture seam. Selection never calls the classifier.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CapturerMock))]
pub trait Capturer: Send + Sync {
    /// Capture one current visual entry or one removed entry's before-side documents.
    fn capture(
        &self,
        accepted: &Accepted,
        path: &str,
        historical: bool,
        cancel: Arc<dyn ChangeCancellation>,
    ) -> Result<BTreeMap<String, File>>;
}

/// Cached documents retain their original bytes and complete resource closure.
pub struct SnapshotCapture;
impl Capturer for SnapshotCapture {
    fn capture(
        &self,
        accepted: &Accepted,
        path: &str,
        historical: bool,
        cancel: Arc<dyn ChangeCancellation>,
    ) -> Result<BTreeMap<String, File>> {
        let _scope = accepted
            .source
            .as_ref()
            .and_then(|source| source.capture_scope(cancel.clone()));
        let result = &accepted.result;
        let mut files = BTreeMap::new();
        let mut selected_kind = None;
        if historical {
            if !result
                .snapshot
                .removed_entries
                .iter()
                .any(|entry| entry.entry.metadata().path == path)
            {
                return Err(ServerError::ChangesUnavailable);
            }
        } else {
            let (parent, selected) = find(&result.review.entries, path, true)
                .or_else(|| find(&result.review.entries, path, false))
                .filter(|(_, entry)| match entry.kind {
                    ReviewKind::Component => true,
                    ReviewKind::Screen => entry.after.is_some(),
                    ReviewKind::UseCase => false,
                })
                .ok_or(ServerError::ChangesUnavailable)?;
            selected_kind = Some(match selected.kind {
                ReviewKind::Screen => EntryKind::Screen,
                ReviewKind::Component => EntryKind::Component,
                ReviewKind::UseCase => EntryKind::UseCase,
            });
            let mut projected = parent.clone();
            projected.variants = (parent.path != selected.path).then(|| vec![selected.clone()]);
            let review = ReviewResultV8 {
                schema_version: 8,
                base_commit: result.review.base_commit.clone(),
                entries: vec![projected],
                affected: Vec::new(),
                diagnostics: Vec::new(),
            };
            let file = encode_review(&review)?;
            if let Err(source) = readers::review(&String::from_utf8_lossy(&file.bytes)) {
                return Err(InternalError::Read { source }.into());
            }
            files.insert("review.json".into(), file);
        }
        let (before, after) = if historical {
            let routes = result
                .before
                .plans()
                .values()
                .filter_map(|plan| {
                    result
                        .before
                        .catalogue()
                        .model
                        .entries
                        .get(plan.entry)
                        .filter(|entry| entry.metadata.path == path)
                        .map(|_| plan.route.clone())
                })
                .collect::<Vec<_>>();
            (routes, Vec::new())
        } else {
            let entry = result
                .entries
                .iter()
                .find(|entry| entry.path == path && Some(entry.kind) == selected_kind)
                .ok_or(ServerError::ChangesUnavailable)?;
            (
                entry
                    .documents
                    .iter()
                    .filter_map(|document| document.before_route.clone())
                    .collect(),
                entry
                    .documents
                    .iter()
                    .filter_map(|document| document.after_route.clone())
                    .collect(),
            )
        };
        let mut remaining =
            MAX_BYTES.saturating_sub(files.values().map(|file| file.bytes.len()).sum());
        capture_side(
            &mut files,
            &mut remaining,
            &before,
            ReviewSide::Before,
            result.before.clone(),
            cancel.as_ref(),
        )?;
        if !historical {
            capture_side(
                &mut files,
                &mut remaining,
                &after,
                ReviewSide::After,
                result.after.clone(),
                cancel.as_ref(),
            )?;
        }
        check(cancel.as_ref())?;
        Ok(files)
    }
}

/// Find the selection and retain its parent as the owner of variant evidence.
fn find<'a>(
    entries: &'a [ReviewEntry],
    path: &str,
    current_only: bool,
) -> Option<(&'a ReviewEntry, &'a ReviewEntry)> {
    for entry in entries {
        if entry.path == path && (!current_only || entry.after.is_some()) {
            return Some((entry, entry));
        }
        if let Some(variants) = &entry.variants
            && let Some((_, selected)) = find(variants, path, current_only)
        {
            return Some((entry, selected));
        }
    }
    None
}

/// Copy one side's requested documents and resource closures into the generation.
/// The base side reads its bounded capture or the pinned-source fallback, and the head
/// side reads its render cache; an evicted view renders again from the same inputs.
fn capture_side(
    files: &mut BTreeMap<String, File>,
    remaining: &mut usize,
    documents: &[String],
    side: ReviewSide,
    graph: Arc<dyn RenderGeneration>,
    cancel: &dyn ChangeCancellation,
) -> Result<()> {
    for route in documents {
        check(cancel)?;
        let artifact = match graph.render(route) {
            Ok(artifact) => artifact,
            Err(source) => return Err(ServerError::Render { source }),
        };
        insert(
            files,
            remaining,
            routes::comparison_snapshot(
                side,
                &format!("{}/{route}", namespace::GENERATED_DIRECTORY),
            ),
            File {
                bytes: artifact.bytes.clone().into(),
                content_type: artifact.content_type.clone(),
            },
        )?;
        let closure = match graph.closure(route) {
            Ok(closure) => closure,
            Err(source) => return Err(ServerError::Render { source }),
        };
        for route in closure.edges.keys() {
            check(cancel)?;
            let relative = route
                .strip_prefix("static/")
                .ok_or(ServerError::PreviewResource)?;
            let target = routes::comparison_snapshot(side, relative);
            if files.contains_key(&target) {
                continue;
            }
            let bytes = match graph.resource_bytes(route) {
                Ok(Some(bytes)) => bytes,
                Ok(None) => return Err(ServerError::PreviewResource),
                Err(source) => return Err(ServerError::Render { source }),
            };
            insert(
                files,
                remaining,
                target,
                File {
                    bytes: bytes.into(),
                    content_type: content_type(route),
                },
            )?;
        }
    }
    Ok(())
}

fn insert(
    files: &mut BTreeMap<String, File>,
    remaining: &mut usize,
    path: String,
    file: File,
) -> Result<()> {
    *remaining = remaining
        .checked_sub(file.bytes.len())
        .ok_or(ServerError::ComparisonCapacity)?;
    files.insert(path, file);
    Ok(())
}

fn check(cancel: &dyn ChangeCancellation) -> Result<()> {
    if cancel.cancelled() {
        Err(ServerError::ChangesReplaced)
    } else {
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/comparison_capture_tests.rs"]
mod comparison_capture_tests;

#[cfg(test)]
#[path = "_tests_/comparison_variant_tests.rs"]
mod comparison_variant_tests;
