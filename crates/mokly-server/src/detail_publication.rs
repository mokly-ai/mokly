//! Bounded detail records prove reuse across publication kinds and revisions.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::public_detail::EntryDetailV4;

use crate::detail_encoding::DetailEncoder;
use crate::error::Result;
use crate::revision_file::RevisionFile;

/// Shared detail values and byte slices, with four fixed slots for each current path.
/// This value owns no snapshots, generations, backends, or publication history.
#[derive(Clone, Default)]
pub struct RecentDetails {
    records: BTreeMap<String, [Option<PublishedDetail>; 4]>,
}

#[derive(Clone, Copy)]
pub(crate) enum PublicationKind {
    Rebuild,
    Usage,
    ChangesStatus,
    ChangesEvidence,
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
                self.records
                    .get(&detail.entry.path)
                    .into_iter()
                    .flatten()
                    .flatten()
                    .find(|record| equivalent(detail, &record.detail))
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
        let path = detail.entry.path.clone();
        self.records.entry(path).or_default()[kind as usize] = Some(PublishedDetail {
            detail: detail.clone(),
            file: file.clone(),
        });
        Ok(file)
    }
}

/// Compare every field except identity values, while retaining revision presence.
pub(crate) fn equivalent(detail: &EntryDetailV4, other: &EntryDetailV4) -> bool {
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
        workspace,
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
        && workspace == &other.workspace
}
