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
/// for a blob that it can read, so each listed object is present.
pub(crate) struct Presence {
    /// The requested records, parsed within the caller's limits, as a listing of
    /// those paths alone returns them.
    pub(crate) entries: Vec<Entry>,
    /// The listed attribute files that no requested path names.
    attributes: Vec<Entry>,
}

impl Presence {
    /// Whether the listing proves each blob of `entries` present.
    pub(crate) fn holds(&self, entries: &[Entry]) -> bool {
        let listed: BTreeSet<_> = self
            .entries
            .iter()
            .chain(&self.attributes)
            .map(|entry| &entry.object)
            .collect();
        entries
            .iter()
            .filter(|entry| entry.mode.regular() || entry.mode == Mode::Symlink)
            .all(|entry| listed.contains(&entry.object))
    }
}

impl GitRepository {
    /// Lists `paths` with the attribute files of their ancestors in one plain
    /// `ls-tree {flags} -z --full-tree {commit}` process. Returns `None`, so the caller
    /// runs its separate listings and the missing-object walk, when a promisor remote
    /// can fetch, when the paths need more than one argument batch, when a path lies
    /// below another listed path, when the command or its parse fails, when the
    /// requested records exceed `limits`, or when a blob has no decimal size. The
    /// listing then prints each requested record exactly as a listing of the requested
    /// paths alone does, and it prints each attribute record that the walk would check.
    pub(crate) fn presence(
        &self,
        commit: &ObjectId,
        flags: &[&str],
        paths: &[RepoPath],
        limits: Limits,
    ) -> Option<Presence> {
        if !self.promisor_remotes.is_empty() || paths.is_empty() || paths.len() > MAX_ARGUMENTS {
            return None;
        }
        let requested: BTreeSet<_> = paths.iter().collect();
        let attributes = attribute_paths(paths).ok()?;
        let added: Vec<_> = attributes
            .iter()
            .filter(|path| !requested.contains(path))
            .collect();
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
        if batches.len() != 1 || nested(paths, &added) {
            return None;
        }
        request.args = batches.pop()?;
        let listing = self.runner.run(&request).ok()?.stdout;
        if !tree::sizes_every_blob(&listing) {
            return None;
        }
        let (requested, attributes) = split_records(&listing, &added)?;
        Some(Presence {
            entries: tree::parse(&requested, limits).ok()?,
            attributes: tree::parse(&attributes, Limits::default()).ok()?,
        })
    }
}

/// Whether a path of `paths` lies at or below another path of `paths` or `added`.
/// The caller bounds both lists to one argument batch first.
fn nested(paths: &[RepoPath], added: &[&RepoPath]) -> bool {
    paths.iter().any(|path| {
        paths
            .iter()
            .chain(added.iter().copied())
            .any(|other| other != path && (other.under(path) || path.under(other)))
    })
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

/// The NUL-terminated records of `listing` that lie at or below no added path, and the
/// records that do. Returns `None` for a listing that does not end its last record.
fn split_records(listing: &[u8], added: &[&RepoPath]) -> Option<(Vec<u8>, Vec<u8>)> {
    if listing.last().is_some_and(|byte| *byte != 0) {
        return None;
    }
    let mut requested = Vec::with_capacity(listing.len());
    let mut attributes = Vec::new();
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
        let part = if extra {
            &mut attributes
        } else {
            &mut requested
        };
        part.extend_from_slice(record);
        part.push(0);
    }
    Some((requested, attributes))
}
