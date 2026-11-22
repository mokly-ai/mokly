//! Bounded detail records prove reuse across publication kinds and revisions.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::public_detail::{EntryDetailV4, Workspace};
use mokly_model::usage::CatalogueUsage;

use crate::detail_encoding::DetailEncoder;
use crate::error::Result;
use crate::revision_file::RevisionFile;

/// Shared detail values and byte slices, with five fixed slots for each current path.
/// This value owns no snapshots, generations, backends, or publication history.
#[derive(Clone, Default)]
pub struct RecentDetails {
    records: BTreeMap<String, [Option<PublishedDetail>; 5]>,
}

/// The slot of a record. A rebuild keeps two records for each path, one for each usage shape.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum PublicationKind {
    /// A rebuilt detail whose views all have ready usage.
    RebuildReady,
    /// A rebuilt detail with a view whose usage is not ready.
    RebuildPending,
    /// A detail of a usage completion.
    Usage,
    /// A detail of a Changes status update.
    ChangesStatus,
    /// A detail of ready Changes evidence.
    ChangesEvidence,
}

impl PublicationKind {
    /// The rebuild record of `detail`: ready when every view has ready usage.
    pub(crate) fn rebuild(detail: &EntryDetailV4) -> Self {
        if detail
            .views
            .iter()
            .all(|view| matches!(view.usage, CatalogueUsage::Ready { .. }))
        {
            Self::RebuildReady
        } else {
            Self::RebuildPending
        }
    }
}

#[derive(Clone)]
struct PublishedDetail {
    detail: Arc<EntryDetailV4>,
    file: RevisionFile,
}

impl RecentDetails {
    pub(crate) fn retain_paths(&mut self, paths: &BTreeMap<String, EntryDetailV4>) {
        self.records.retain(|path, _| paths.contains_key(path));
    }

    pub(crate) fn publish(
        &mut self,
        kind: PublicationKind,
        detail: &mut Arc<EntryDetailV4>,
        adjacent: Option<(&Arc<EntryDetailV4>, &RevisionFile)>,
        encoder: &dyn DetailEncoder,
    ) -> Result<RevisionFile> {
        let equal = adjacent
            .filter(|(old, _)| equivalent(detail, old))
            .or_else(|| {
                self.find(detail)
                    .map(|record| (&record.detail, &record.file))
            });
        let file = if let Some((old, file)) = equal {
            if detail.detail_id != old.detail_id {
                Arc::make_mut(detail).detail_id = old.detail_id.clone();
            }
            file.clone()
        } else {
            encoder.encode(Arc::make_mut(detail))?
        };
        if let Some((old, _)) = adjacent
            && *detail == *old
        {
            *detail = old.clone();
        }
        self.keep(kind, detail, &file);
        Ok(file)
    }

    /// The record of one publication kind for a path.
    pub(crate) fn record(
        &self,
        path: &str,
        kind: PublicationKind,
    ) -> Option<(&Arc<EntryDetailV4>, &RevisionFile)> {
        let record = self.records.get(path)?[kind as usize].as_ref()?;
        Some((&record.detail, &record.file))
    }

    /// Whether a record of the detail's path equals it, as `publish` compares.
    pub(crate) fn holds(&self, detail: &EntryDetailV4) -> bool {
        self.find(detail).is_some()
    }

    /// Keep an encoded detail as the ready rebuild record of its path.
    pub(crate) fn prime(&mut self, detail: Arc<EntryDetailV4>, file: RevisionFile) {
        self.keep(PublicationKind::RebuildReady, &detail, &file);
    }

    fn find(&self, detail: &EntryDetailV4) -> Option<&PublishedDetail> {
        self.records
            .get(&detail.entry.path)
            .into_iter()
            .flatten()
            .flatten()
            .find(|record| equivalent(detail, &record.detail))
    }

    fn keep(&mut self, kind: PublicationKind, detail: &Arc<EntryDetailV4>, file: &RevisionFile) {
        let path = detail.entry.path.clone();
        self.records.entry(path).or_default()[kind as usize] = Some(PublishedDetail {
            detail: detail.clone(),
            file: file.clone(),
        });
    }
}

/// Compare every field except identity values, while retaining revision presence.
pub(crate) fn equivalent(detail: &EntryDetailV4, other: &EntryDetailV4) -> bool {
    equivalent_with(detail, detail.workspace.as_ref(), other)
}

/// Compare `detail` with `workspace` in place of its own, as `equivalent` compares.
pub(crate) fn equivalent_with(
    detail: &EntryDetailV4,
    workspace: Option<&Workspace>,
    other: &EntryDetailV4,
) -> bool {
    let EntryDetailV4 {
        schema_version,
        identity,
        detail_id: _,
        revision,
        entry,
        reasons,
        before,
        views,
        control_order,
        resource_evidence,
        workspace: _,
    } = detail;
    *schema_version == other.schema_version
        && identity == &other.identity
        && revision.is_some() == other.revision.is_some()
        && entry == &other.entry
        && reasons == &other.reasons
        && before == &other.before
        && views == &other.views
        && control_order == &other.control_order
        && resource_evidence == &other.resource_evidence
        && workspace == other.workspace.as_ref()
}
