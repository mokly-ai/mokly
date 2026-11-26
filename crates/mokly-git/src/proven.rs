//! Commit metadata and object presence that one repository session already proved.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;

use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Mode};

/// A commit and the sorted attribute files that one lookup asked for.
type AttributeQuery = (ObjectId, Vec<RepoPath>);

/// A commit's tree never changes, and an object that the store holds stays there
/// for the session. So each proof answers every later equal question without Git.
#[derive(Default)]
pub(crate) struct Proven {
    attributes: Mutex<BTreeMap<AttributeQuery, Vec<Entry>>>,
    present: Mutex<BTreeSet<ObjectId>>,
    empty: Mutex<BTreeMap<ObjectId, BTreeSet<String>>>,
}

impl Proven {
    /// The listed attribute files and directories of an equal earlier lookup.
    pub(crate) fn attributes(&self, commit: &ObjectId, paths: &[RepoPath]) -> Option<Vec<Entry>> {
        self.attributes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&(commit.clone(), paths.to_vec()))
            .cloned()
    }

    /// Keep the answer of one attribute lookup of `commit`.
    pub(crate) fn keep_attributes(
        &self,
        commit: &ObjectId,
        paths: Vec<RepoPath>,
        entries: &[Entry],
    ) {
        self.attributes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert((commit.clone(), paths), entries.to_vec());
    }

    /// Whether an earlier check proved that the store holds each object.
    pub(crate) fn all_present(&self, objects: &BTreeSet<ObjectId>) -> bool {
        let present = self
            .present
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        objects.iter().all(|object| present.contains(object))
    }

    /// Whether an earlier lookup showed that `commit` holds nothing below an ancestor
    /// of `path`, because that ancestor is missing or is not a directory.
    pub(crate) fn below_empty(&self, commit: &ObjectId, path: &RepoPath) -> bool {
        let empty = self.empty.lock().unwrap_or_else(|error| error.into_inner());
        let Some(directories) = empty.get(commit) else {
            return false;
        };
        let path = path.as_str();
        path.match_indices('/')
            .any(|(index, _)| directories.contains(&path[..index]))
    }

    /// Keep paths of `commit` that hold nothing below them.
    pub(crate) fn keep_empty(&self, commit: &ObjectId, directories: Vec<String>) {
        if directories.is_empty() {
            return;
        }
        self.empty
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(commit.clone())
            .or_default()
            .extend(directories);
    }

    /// Keep objects that a check or a sized listing proved present.
    pub(crate) fn keep_present(&self, objects: impl IntoIterator<Item = ObjectId>) {
        self.present
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .extend(objects);
    }
}

/// The blob and link objects of a listing, the objects that an object check asks about.
pub(crate) fn blobs(entries: &[Entry]) -> impl Iterator<Item = ObjectId> + '_ {
    entries
        .iter()
        .filter(|entry| entry.mode.regular() || entry.mode == Mode::Symlink)
        .map(|entry| entry.object.clone())
}

impl GitRepository {
    /// The session's proofs, used only without a promisor remote. A promisor
    /// repository checks each read again, so a fetch can restore a lost object.
    pub(crate) fn proven(&self) -> Option<&Proven> {
        self.promisor_remotes.is_empty().then_some(&self.proven)
    }

    /// Keep the blobs of a listing that gave a decimal size for each blob.
    pub(crate) fn keep_present(&self, entries: &[Entry]) {
        if let Some(proven) = self.proven() {
            proven.keep_present(blobs(entries));
        }
    }
}
