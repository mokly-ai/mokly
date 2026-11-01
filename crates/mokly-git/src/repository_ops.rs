//! Repository operations delegate to bounded checkout and index implementations.

use std::io::Write;
use std::path::Path;

use crate::access::WorkingFile;
use crate::changes::Change;
use crate::command::DEFAULT_OUTPUT_LIMIT;
use crate::error::{Error, Result};
use crate::extracted::ExtractedFiles;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::{BlobDigest, GitRepository, Repository};
use crate::tree::{self, Entry, Limits};

impl Repository for GitRepository {
    fn merge_base(&self, base: &str) -> Result<ObjectId> {
        self.merge_base_of(base)
    }
    fn changed_paths(&self, base: &ObjectId) -> Result<Vec<Change>> {
        self.changes_from(base)
    }

    fn list(
        &self,
        commit: &ObjectId,
        root: Option<&RepoPath>,
        limits: Limits,
    ) -> Result<Vec<Entry>> {
        let mut args = vec![
            "ls-tree",
            "-r",
            "-t",
            "-l",
            "-z",
            "--full-tree",
            commit.as_str(),
            "--",
        ];
        if let Some(root) = root {
            args.push(root.as_str());
        }
        let entries = tree::parse(&self.command(&args, vec![], DEFAULT_OUTPUT_LIMIT)?, limits)?;
        if self.ensure_checkout_objects(commit, &entries)? {
            return tree::parse(&self.command(&args, vec![], DEFAULT_OUTPUT_LIMIT)?, limits);
        }
        Ok(entries)
    }

    fn lookup(&self, commit: &ObjectId, paths: &[RepoPath], limits: Limits) -> Result<Vec<Entry>> {
        self.lookup_paths(commit, paths, limits)
    }

    fn digest(&self, commit: &ObjectId, entry: &Entry) -> Result<String> {
        self.checkout_digest(commit, entry)
    }
    fn digest_many(&self, commit: &ObjectId, entries: &[Entry]) -> Vec<Result<BlobDigest>> {
        self.checkout_digest_many(commit, entries)
    }
    fn stream(
        &self,
        commit: &ObjectId,
        entry: &Entry,
        output: &mut (dyn Write + Send),
        limit: usize,
    ) -> Result<usize> {
        self.checkout_stream(commit, entry, output, limit)
    }

    fn read(&self, commit: &ObjectId, path: &RepoPath, limit: usize) -> Result<Vec<u8>> {
        let entry = self
            .list(commit, Some(path), Limits::default())?
            .into_iter()
            .find(|entry| &entry.path == path);
        let Some(entry) = entry else {
            return Err(Error::MissingBlob {
                path: path.as_str().to_owned(),
            });
        };
        if !entry.mode.regular() {
            return Err(Error::NotRegular {
                path: path.as_str().to_owned(),
            });
        }
        self.checkout_read(
            commit,
            &[entry],
            Limits {
                bytes: limit,
                blob: limit,
                ..Limits::default()
            },
        )?
        .pop()
        .ok_or(Error::MalformedOutput)
    }

    fn read_many(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
        limits: Limits,
    ) -> Result<Vec<Vec<u8>>> {
        self.checkout_read(commit, entries, limits)
    }

    fn fingerprint_extracted(&self, root: &Path, entries: &[Entry]) -> Result<ExtractedFiles> {
        self.extracted_fingerprints(root, entries)
    }

    fn read_extracted(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
        limits: Limits,
        extracted: &ExtractedFiles,
    ) -> Result<Vec<Vec<u8>>> {
        self.extracted_read(commit, entries, limits, extracted)
    }

    fn digest_extracted(
        &self,
        commit: &ObjectId,
        entry: &Entry,
        extracted: &ExtractedFiles,
    ) -> Result<String> {
        self.extracted_digest(commit, entry, extracted)
    }

    fn working_paths(&self) -> Result<Vec<RepoPath>> {
        self.candidates()
    }

    fn working(&self, path: &RepoPath, limit: usize) -> Result<Option<WorkingFile>> {
        self.working_file(path, limit)
    }

    fn working_bytes(&self, path: &RepoPath, limit: usize) -> Result<Option<Vec<u8>>> {
        self.disk.read(&self.directory, path, limit)
    }

    fn working_hashes(&self, paths: &[RepoPath], limit: usize) -> Result<Vec<ObjectId>> {
        self.clean_hashes(paths, limit)
    }

    fn conversion_warnings(&self) -> Vec<(String, String)> {
        self.unavailable
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
            .map(|(path, message)| (path.clone(), message.clone()))
            .collect()
    }
    fn source_key(&self, commit: &ObjectId) -> Result<String> {
        self.checkout_key(commit)
    }
    fn extract(&self, commit: &ObjectId, destination: &Path, limits: Limits) -> Result<()> {
        self.extract_sources(commit, destination, limits)
    }
}
