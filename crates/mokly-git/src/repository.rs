//! Validated checkout access through bounded Git commands and immutable blobs.

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::access::WorkingFile;
use crate::blob_batches;
use crate::changes::{self, Change, ChangedPath, Kind};
use crate::command::{DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request, Runner};
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
    /// Look up exact paths without enumerating their descendants.
    fn lookup(&self, commit: &ObjectId, paths: &[RepoPath], limits: Limits) -> Result<Vec<Entry>>;
    /// Hash an immutable blob through a bounded streaming reader.
    fn digest(&self, entry: &Entry) -> Result<String>;
    /// Read an exact regular blob by path, without filters or symlink traversal.
    fn read(&self, commit: &ObjectId, path: &RepoPath, limit: usize) -> Result<Vec<u8>>;
    /// Read regular entries in bounded batches using their already-proved object ids.
    fn read_many(&self, entries: &[Entry], limits: Limits) -> Result<Vec<Vec<u8>>>;
    /// Enumerate tracked and nonignored untracked working paths without recursion into submodules.
    fn working_paths(&self) -> Result<Vec<RepoPath>>;
    /// Read regular working bytes and their Git-clean object identity.
    fn working(&self, path: &RepoPath, limit: usize) -> Result<Option<WorkingFile>>;
    /// Read confined regular working bytes without starting Git.
    fn working_bytes(&self, path: &RepoPath, limit: usize) -> Result<Option<Vec<u8>>>;
    /// Hash confined working paths in one Git-clean stdin-paths batch.
    fn working_hashes(&self, paths: &[RepoPath], limit: usize) -> Result<Vec<ObjectId>>;
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

pub(crate) struct GitRepository {
    pub(crate) directory: PathBuf,
    pub(crate) runner: Arc<dyn Runner>,
    pub(crate) disk: Arc<dyn Disk>,
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
    pub(crate) fn command(&self, args: &[&str], stdin: Vec<u8>, limit: usize) -> Result<Vec<u8>> {
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
                stderr_limit: DEFAULT_STDERR_LIMIT,
            })?
            .stdout)
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
            let Some(value) = tree::candidate(field) else {
                continue;
            };
            let path = ChangedPath::parse(value)?;
            changes
                .entry(path.clone())
                .and_modify(|change| {
                    if change.kind == Kind::Deleted {
                        change.kind = Kind::Modified;
                    }
                })
                .or_insert(Change {
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
        tree::parse(&self.command(&args, vec![], DEFAULT_OUTPUT_LIMIT)?, limits)
    }

    fn lookup(&self, commit: &ObjectId, paths: &[RepoPath], limits: Limits) -> Result<Vec<Entry>> {
        self.lookup_paths(commit, paths, limits)
    }

    fn digest(&self, entry: &Entry) -> Result<String> {
        self.digest_blob(entry)
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

    fn read_many(&self, entries: &[Entry], limits: Limits) -> Result<Vec<Vec<u8>>> {
        self.read_entries(entries, limits)
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

    fn extract(&self, commit: &ObjectId, destination: &Path, limits: Limits) -> Result<()> {
        let entries: Vec<_> = self
            .list(commit, None, limits)?
            .into_iter()
            .filter(|entry| entry.mode.regular())
            .collect();
        let mut bytes = 0usize;
        for entry in &entries {
            if entry.size > limits.blob {
                return Err(Error::BlobLimit {
                    path: entry.path.to_string(),
                    limit: limits.blob,
                });
            }
            bytes = bytes.saturating_add(entry.size);
            if bytes > limits.bytes {
                return Err(Error::ByteLimit {
                    limit: limits.bytes,
                });
            }
        }
        let mut archive = self.disk.archive(destination)?;
        for range in blob_batches::split(&entries, blob_batches::BYTES, blob_batches::COUNT)? {
            let batch = &entries[range];
            let contents = self.load(batch, limits.bytes)?;
            let files = batch
                .iter()
                .zip(contents)
                .map(|(entry, bytes)| ArchiveFile {
                    path: entry.path.clone(),
                    bytes,
                    executable: entry.mode == Mode::Executable,
                })
                .collect::<Vec<_>>();
            archive.write(&files)?;
        }
        archive.finish()
    }
}

#[cfg(test)]
#[path = "_tests_/repository_tests.rs"]
mod repository_tests;

impl fmt::Debug for dyn Repository + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Repository")
    }
}
