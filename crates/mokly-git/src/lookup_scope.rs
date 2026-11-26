//! Exact lookups without a promisor remote learn which directories on the way are missing.

use std::collections::BTreeSet;
use std::ffi::OsString;

use crate::batches::{self, MAX_ARGUMENT_BYTES, MAX_ARGUMENTS};
use crate::error::Result;
use crate::identity::{ObjectId, RepoPath};
use crate::proven::Proven;
use crate::repository::GitRepository;
use crate::tree::{self, Entry, Limits, Mode};

impl GitRepository {
    /// Look up exact paths of `commit` with `ls-tree -t`, which also prints each tree
    /// that Git enters on the way to a requested path. An ancestor that Git does not
    /// print is missing or is not a directory, so the commit holds nothing below it,
    /// and a later lookup of paths below it starts no process. The result leaves out
    /// the entered trees again, so it equals the listing without `-t`, record for record.
    pub(crate) fn lookup_scoped(
        &self,
        proven: &Proven,
        commit: &ObjectId,
        paths: &[RepoPath],
        limits: Limits,
    ) -> Result<Vec<Entry>> {
        if paths.iter().all(|path| proven.below_empty(commit, path)) {
            return Ok(Vec::new());
        }
        let mut request = self.tree_request(&[
            "ls-tree",
            "-l",
            "-t",
            "-z",
            "--full-tree",
            commit.as_str(),
            "--",
        ]);
        let prefix = request.args.len();
        let arguments: Vec<_> = paths
            .iter()
            .map(|path| OsString::from(path.as_str()))
            .collect();
        let mut entries = Vec::new();
        for args in batches::split(&request.args, &arguments, MAX_ARGUMENTS, MAX_ARGUMENT_BYTES)? {
            let requested: Vec<String> = args[prefix..]
                .iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            request.args = args;
            let output = self.initial_tree_listing(&request)?;
            let exact = without_entered_trees(&output, &requested);
            entries.extend(tree::parse(&exact, limits)?);
            let all = Limits {
                files: usize::MAX,
                nodes: usize::MAX,
                ..limits
            };
            if let Ok(listed) = tree::parse(&output, all) {
                if tree::sizes_every_blob(&output) {
                    self.keep_present(&listed);
                }
                proven.keep_empty(commit, empty_ancestors(&requested, &listed));
            }
        }
        self.ensure_checkout_objects(commit, &entries)?;
        Ok(entries)
    }
}

/// The first ancestor of each requested path that the listing lacks as a tree. Git
/// enters every tree above a requested path, so `-t` prints each one that exists.
fn empty_ancestors(requested: &[String], listed: &[Entry]) -> Vec<String> {
    let trees: BTreeSet<&str> = listed
        .iter()
        .filter(|entry| entry.mode == Mode::Directory)
        .map(|entry| entry.path.as_str())
        .collect();
    let found: BTreeSet<&str> = listed.iter().map(|entry| entry.path.as_str()).collect();
    requested
        .iter()
        .filter(|path| !found.contains(path.as_str()))
        .filter_map(|path| {
            path.match_indices('/')
                .map(|(index, _)| &path[..index])
                .find(|ancestor| !trees.contains(ancestor))
                .map(str::to_owned)
        })
        .collect()
}

/// The records of an `ls-tree -t -z` listing without the trees that Git printed only
/// because it entered them: each tree with a requested path below it. Without `-t`,
/// Git enters the same trees and prints every other record in the same order.
fn without_entered_trees(output: &[u8], requested: &[String]) -> Vec<u8> {
    if output.last().is_some_and(|byte| *byte != 0) {
        return output.to_vec();
    }
    let mut exact = Vec::with_capacity(output.len());
    for record in output
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        if !entered_tree(record, requested) {
            exact.extend_from_slice(record);
            exact.push(0);
        }
    }
    exact
}

fn entered_tree(record: &[u8], requested: &[String]) -> bool {
    let Some(tab) = record.iter().position(|byte| *byte == b'\t') else {
        return false;
    };
    let tree = record[..tab]
        .split(u8::is_ascii_whitespace)
        .filter(|field| !field.is_empty())
        .nth(1)
        == Some(b"tree".as_slice());
    let Ok(path) = std::str::from_utf8(&record[tab + 1..]) else {
        return false;
    };
    tree && requested.iter().any(|requested| {
        requested
            .strip_prefix(path)
            .is_some_and(|rest| rest.starts_with('/'))
    })
}
