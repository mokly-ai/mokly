//! One sized listing proves requested base objects present without the missing-object walk.

use std::collections::BTreeSet;
use std::ffi::OsString;

use crate::batches::{self, MAX_ARGUMENT_BYTES, MAX_ARGUMENTS};
use crate::error::Result;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{self, Entry, Limits, Mode};

/// A sized listing of requested paths together with the attribute files of their
/// ancestors, in which each blob record has a decimal size. Git prints a size only
/// for a blob that the object store holds, so each listed object is present.
pub(crate) struct Presence {
    /// The records of the requested paths, as a listing of those paths alone prints them.
    requested: Vec<u8>,
    /// The object of each record of the listing.
    objects: BTreeSet<ObjectId>,
}

impl Presence {
    /// The requested records within `limits`, or `None` when they exceed them, so the
    /// caller's own listing returns the typed error.
    pub(crate) fn entries(&self, limits: Limits) -> Option<Vec<Entry>> {
        tree::parse(&self.requested, limits).ok()
    }

    /// Whether the listing proves each blob of `entries` present.
    pub(crate) fn holds(&self, entries: &[Entry]) -> bool {
        entries
            .iter()
            .filter(|entry| entry.mode.regular() || entry.mode == Mode::Symlink)
            .all(|entry| self.objects.contains(&entry.object))
    }
}

impl GitRepository {
    /// Lists `paths` with the attribute files of their ancestors in one plain
    /// `ls-tree {flags} -z --full-tree {commit}` process. Returns `None`, so the caller
    /// runs its separate listings and the missing-object walk, when a promisor remote
    /// can fetch, when the paths need more than one argument batch, when a path lies
    /// below another listed path, when the command or its parse fails, or when a blob
    /// has no decimal size. The listing then prints each requested record exactly as a
    /// listing of the requested paths alone does, and it prints each attribute record
    /// that the walk would check.
    pub(crate) fn presence(
        &self,
        commit: &ObjectId,
        flags: &[&str],
        paths: &[RepoPath],
    ) -> Option<Presence> {
        if !self.promisor_remotes.is_empty() || paths.is_empty() {
            return None;
        }
        let requested: BTreeSet<_> = paths.iter().collect();
        let attributes = attribute_paths(paths).ok()?;
        let added: Vec<_> = attributes
            .iter()
            .filter(|path| !requested.contains(path))
            .collect();
        let nested = paths.iter().any(|path| {
            paths
                .iter()
                .chain(added.iter().copied())
                .any(|other| other != path && (other.under(path) || path.under(other)))
        });
        if nested {
            return None;
        }
        let mut arguments = vec!["ls-tree"];
        arguments.extend_from_slice(flags);
        arguments.extend(["-z", "--full-tree", commit.as_str(), "--"]);
        let mut request = self.tree_request(&arguments);
        let listed: Vec<_> = paths
            .iter()
            .chain(added.iter().copied())
            .map(|path| OsString::from(path.as_str()))
            .collect();
        let mut batches =
            batches::split(&request.args, &listed, MAX_ARGUMENTS, MAX_ARGUMENT_BYTES).ok()?;
        if batches.len() != 1 {
            return None;
        }
        request.args = batches.pop()?;
        let listing = self.runner.run(&request).ok()?.stdout;
        if !tree::sizes_every_blob(&listing) {
            return None;
        }
        let objects = tree::parse(&listing, Limits::default())
            .ok()?
            .into_iter()
            .map(|entry| entry.object)
            .collect();
        Some(Presence {
            requested: requested_records(&listing, &added)?,
            objects,
        })
    }
}

/// The root attribute file and the attribute file of each ancestor directory of `paths`.
pub(crate) fn attribute_paths(paths: &[RepoPath]) -> Result<BTreeSet<RepoPath>> {
    let mut attributes = BTreeSet::new();
    attributes.insert(RepoPath::parse(".gitattributes")?);
    for path in paths {
        let mut parent = path.as_str();
        while let Some((directory, _)) = parent.rsplit_once('/') {
            attributes.insert(RepoPath::parse(&format!("{directory}/.gitattributes"))?);
            parent = directory;
        }
    }
    Ok(attributes)
}

/// The NUL-terminated records of `listing` that lie at or below no added path.
/// Returns `None` for a listing that does not end its last record.
fn requested_records(listing: &[u8], added: &[&RepoPath]) -> Option<Vec<u8>> {
    if listing.last().is_some_and(|byte| *byte != 0) {
        return None;
    }
    let mut requested = Vec::with_capacity(listing.len());
    for record in listing
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let tab = record.iter().position(|byte| *byte == b'\t')?;
        let path = &record[tab + 1..];
        let extra = added.iter().any(|added| {
            let added = added.as_str().as_bytes();
            path.strip_prefix(added)
                .is_some_and(|rest| rest.is_empty() || rest.starts_with(b"/"))
        });
        if !extra {
            requested.extend_from_slice(record);
            requested.push(0);
        }
    }
    Some(requested)
}
