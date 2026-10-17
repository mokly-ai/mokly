//! Capture only requested view closures from the accepted immutable render handles.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_compare::comparison_types::EntryClassification;
use mokly_graph::types::RenderGeneration;
use mokly_model::review::{ReviewEntry, ReviewKind, ReviewResultV8};
use mokly_model::{namespace, readers};

use crate::assets::{File, content_type};
use crate::changes::{Accepted, ChangeCancellation};
use crate::error::{InternalError, Result, ServerError};
use crate::snapshot::encode;

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
        let entry = result
            .entries
            .iter()
            .find(|entry| entry.path == path)
            .ok_or(ServerError::ChangesUnavailable)?;
        let mut files = BTreeMap::new();
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
            let mut selected = find(&result.review.entries, path)
                .filter(|entry| match entry.kind {
                    ReviewKind::Component => true,
                    ReviewKind::Screen => entry.after.is_some(),
                    ReviewKind::UseCase => false,
                })
                .ok_or(ServerError::ChangesUnavailable)?
                .clone();
            selected.variants = None;
            let review = ReviewResultV8 {
                schema_version: 8,
                base_commit: result.review.base_commit.clone(),
                entries: vec![selected],
                affected: Vec::new(),
                diagnostics: Vec::new(),
            };
            let file = encode(&review)?;
            if let Err(source) = readers::review(&String::from_utf8_lossy(&file.bytes)) {
                return Err(InternalError::Read { source }.into());
            }
            files.insert("review.json".into(), file);
        }
        let mut remaining =
            MAX_BYTES.saturating_sub(files.values().map(|file| file.bytes.len()).sum());
        capture_side(
            &mut files,
            &mut remaining,
            entry,
            "before",
            result.before.clone(),
            cancel.as_ref(),
        )?;
        if !historical {
            capture_side(
                &mut files,
                &mut remaining,
                entry,
                "after",
                result.after.clone(),
                cancel.as_ref(),
            )?;
        }
        check(cancel.as_ref())?;
        Ok(files)
    }
}

fn find<'a>(entries: &'a [ReviewEntry], path: &str) -> Option<&'a ReviewEntry> {
    for entry in entries {
        if entry.path == path {
            return Some(entry);
        }
        if let Some(variants) = &entry.variants
            && let Some(entry) = find(variants, path)
        {
            return Some(entry);
        }
    }
    None
}

fn capture_side(
    files: &mut BTreeMap<String, File>,
    remaining: &mut usize,
    entry: &EntryClassification,
    side: &str,
    graph: Arc<dyn RenderGeneration>,
    cancel: &dyn ChangeCancellation,
) -> Result<()> {
    for document in &entry.documents {
        check(cancel)?;
        let route = if side == "before" {
            &document.before_route
        } else {
            &document.after_route
        };
        let Some(route) = route else {
            continue;
        };
        let artifact = match graph.render(route) {
            Ok(artifact) => artifact,
            Err(source) => return Err(ServerError::Render { source }),
        };
        insert(
            files,
            remaining,
            format!(
                "snapshots/{side}/{}/{route}",
                namespace::GENERATED_DIRECTORY
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
            let target = format!("snapshots/{side}/{relative}");
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
