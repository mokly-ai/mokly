//! Validated checkout access through bounded Git commands and immutable blobs.

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::blob_batches;
use crate::changes::{self, Change, ChangedPath, Kind};
use crate::command::{DEFAULT_OUTPUT_LIMIT, Request, Runner};
use crate::disk::{ArchiveFile, Disk};
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::tree::{self, Entry, Limits, Mode, text};

/// Immutable-base operations for a validated repository root.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RepositoryMock))]
pub trait Repository: Send + Sync {
    /// Resolve a configured ref, then find its merge base with HEAD.
    fn merge_base(&self, base: &str) -> Result<ObjectId>;
    /// Diff the base against index and working files, then include untracked files.
    fn changed_paths(&self, base: &ObjectId) -> Result<Vec<Change>>;
    /// List leaves below an exact root; `None` lists the whole tree.
    fn list(
        &self,
        commit: &ObjectId,
        root: Option<&RepoPath>,
        limits: Limits,
    ) -> Result<Vec<Entry>>;
    /// Read an exact regular blob by path, without filters or symlink traversal.
    fn read(&self, commit: &ObjectId, path: &RepoPath, limit: usize) -> Result<Vec<u8>>;
    /// Extract a bounded source archive into a fresh directory.
    fn extract(&self, commit: &ObjectId, destination: &Path, limits: Limits) -> Result<()>;
}

/// Repository opening and root-identity boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RepositoriesMock))]
pub trait Repositories: Send + Sync {
    /// Validate repoRoot against Git's canonical checkout root before other reads.
    fn open(&self, root: &Path) -> Result<Arc<dyn Repository>>;
}

/// Composition adapter for Git commands and filesystem projection.
pub struct GitRepositories {
    /// Bounded process runner.
    pub runner: Arc<dyn Runner>,
    /// Filesystem identity and extraction boundary.
    pub disk: Arc<dyn Disk>,
}

struct GitRepository {
    directory: PathBuf,
    runner: Arc<dyn Runner>,
    disk: Arc<dyn Disk>,
}

impl Repositories for GitRepositories {
    fn open(&self, root: &Path) -> Result<Arc<dyn Repository>> {
        let configured = self.disk.canonicalize(root)?;
        let repository = GitRepository {
            directory: configured.clone(),
            runner: Arc::clone(&self.runner),
            disk: Arc::clone(&self.disk),
        };
        let output = repository.command(
            &["rev-parse", "--show-toplevel"],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let actual = self
            .disk
            .canonicalize(Path::new(text(&output)?.trim_end_matches(['\r', '\n'])))?;
        if configured != actual {
            return Err(Error::RootMismatch { configured, actual });
        }
        Ok(Arc::new(repository))
    }
}

impl GitRepository {
    fn command(&self, args: &[&str], stdin: Vec<u8>, limit: usize) -> Result<Vec<u8>> {
        let mut arguments = vec![
            OsString::from("--no-optional-locks"),
            OsString::from("--literal-pathspecs"),
        ];
        arguments.extend(args.iter().map(OsString::from));
        Ok(self
            .runner
            .run(&Request {
                directory: self.directory.clone(),
                args: arguments,
                stdin,
                output_limit: limit,
            })?
            .stdout)
    }

    fn load(&self, entries: &[Entry], limit: usize) -> Result<Vec<Vec<u8>>> {
        let total = entries
            .iter()
            .fold(0usize, |sum, entry| sum.saturating_add(entry.size));
        if total > limit {
            return Err(Error::ByteLimit { limit });
        }
        let mut result = Vec::new();
        for range in blob_batches::split(entries, blob_batches::BYTES, blob_batches::COUNT)? {
            let batch = &entries[range];
            let mut input = Vec::new();
            let mut bytes = 0usize;
            for entry in batch {
                input.extend_from_slice(entry.object.as_str().as_bytes());
                input.push(b'\n');
                bytes += blob_batches::cost(entry);
            }
            result.extend(tree::blobs(
                &self.command(&["cat-file", "--batch"], input, bytes)?,
                batch,
            )?);
        }
        Ok(result)
    }
}

impl Repository for GitRepository {
    fn merge_base(&self, base: &str) -> Result<ObjectId> {
        let reference = format!("{base}^{{commit}}");
        let resolved = self.command(
            &["rev-parse", "--verify", "--end-of-options", &reference],
            vec![],
            1024,
        )?;
        let resolved = ObjectId::parse(text(&resolved)?.trim())?;
        match self.command(&["merge-base", resolved.as_str(), "HEAD"], vec![], 1024) {
            Ok(output) => ObjectId::parse(text(&output)?.trim()),
            Err(Error::CommandFailed {
                status: Some(1), ..
            }) => Err(Error::NoMergeBase),
            Err(error) => Err(error),
        }
    }

    fn changed_paths(&self, base: &ObjectId) -> Result<Vec<Change>> {
        let tracked = self.command(
            &[
                "diff",
                "--name-status",
                "-z",
                "--find-renames",
                "--no-ext-diff",
                "--no-textconv",
                base.as_str(),
                "--",
            ],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let mut changes: BTreeMap<_, _> = changes::parse(&tracked)?
            .into_iter()
            .map(|change| (change.path.clone(), change))
            .collect();
        let untracked = self.command(
            &["ls-files", "--others", "--exclude-standard", "-z"],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        for field in changes::fields(&untracked)? {
            let path = ChangedPath::parse(text(field)?)?;
            changes.entry(path.clone()).or_insert(Change {
                path,
                kind: Kind::Added,
            });
        }
        Ok(changes.into_values().collect())
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
            "-l",
            "-z",
            "--full-tree",
            commit.as_str(),
            "--",
        ];
        if let Some(root) = root {
            args.push(root.as_str());
        }
        tree::parse(&self.command(&args, vec![], DEFAULT_OUTPUT_LIMIT)?, limits)
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
        if entry.size > limit {
            return Err(Error::ByteLimit { limit });
        }
        self.load(&[entry], limit)?
            .pop()
            .ok_or(Error::MalformedOutput)
    }

    fn extract(&self, commit: &ObjectId, destination: &Path, limits: Limits) -> Result<()> {
        let entries: Vec<_> = self
            .list(commit, None, limits)?
            .into_iter()
            .filter(|entry| entry.mode.regular())
            .collect();
        let mut bytes = 0usize;
        for entry in &entries {
            if entry.size > limits.blob {
                return Err(Error::ByteLimit { limit: limits.blob });
            }
            bytes = bytes.saturating_add(entry.size);
            if bytes > limits.bytes {
                return Err(Error::ByteLimit {
                    limit: limits.bytes,
                });
            }
        }
        let contents = self.load(&entries, limits.bytes)?;
        let files = entries
            .into_iter()
            .zip(contents)
            .map(|(entry, bytes)| ArchiveFile {
                path: entry.path,
                bytes,
                executable: entry.mode == Mode::Executable,
            })
            .collect::<Vec<_>>();
        self.disk.extract(destination, &files)
    }
}

#[cfg(test)]
#[path = "_tests_/repository_tests.rs"]
mod repository_tests;
