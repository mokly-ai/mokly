//! Validated checkout access through bounded Git commands and immutable blobs.

use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::access::WorkingFile;
use crate::changes::Change;
use crate::command::{DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request, Runner};
use crate::disk::Disk;
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::tree::{self, Entry, Limits, text};

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
    /// Hash a commit file after Git checkout conversion.
    fn digest(&self, commit: &ObjectId, entry: &Entry) -> Result<String>;
    /// Read an exact regular file after Git checkout conversion.
    fn read(&self, commit: &ObjectId, path: &RepoPath, limit: usize) -> Result<Vec<u8>>;
    /// Read regular commit files after checkout conversion.
    fn read_many(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
        limits: Limits,
    ) -> Result<Vec<Vec<u8>>>;
    /// Enumerate tracked and nonignored untracked working paths without recursion into submodules.
    fn working_paths(&self) -> Result<Vec<RepoPath>>;
    /// Read regular working bytes and their Git-clean object identity.
    fn working(&self, path: &RepoPath, limit: usize) -> Result<Option<WorkingFile>>;
    /// Read confined regular working bytes without starting Git.
    fn working_bytes(&self, path: &RepoPath, limit: usize) -> Result<Option<Vec<u8>>>;
    /// Hash confined working paths in one Git-clean stdin-paths batch.
    fn working_hashes(&self, paths: &[RepoPath], limit: usize) -> Result<Vec<ObjectId>>;
    /// Conversion failures observed during this repository session.
    fn conversion_warnings(&self) -> Vec<(String, String)> {
        Vec::new()
    }
    /// Source cache identity includes the user's current checkout settings.
    fn source_key(&self, commit: &ObjectId) -> Result<String> {
        Ok(commit.to_string())
    }
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
    pub(crate) fetch_lock: Mutex<()>,
    pub(crate) unavailable: Mutex<BTreeMap<String, String>>,
    /// Files whose own conversion reached its deadline: commit, blob, and path.
    pub(crate) timed_out: Mutex<BTreeSet<(ObjectId, ObjectId, RepoPath)>>,
    pub(crate) directory: PathBuf,
    pub(crate) runner: Arc<dyn Runner>,
    pub(crate) disk: Arc<dyn Disk>,
}

impl Repositories for GitRepositories {
    /// Compares the canonical configured directory with the canonical
    /// `rev-parse --show-toplevel` result. A symlink alias of the root passes;
    /// a subdirectory or another checkout fails with both paths.
    fn open(&self, root: &Path) -> Result<Arc<dyn Repository>> {
        let configured = self.disk.canonicalize(root)?;
        let repository = GitRepository {
            fetch_lock: Mutex::new(()),
            unavailable: Mutex::new(BTreeMap::new()),
            timed_out: Mutex::new(BTreeSet::new()),
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
        if entries.len() > limits.files {
            return Err(Error::FileCount {
                limit: limits.files,
            });
        }
        for entry in entries {
            if !entry.mode.regular() {
                return Err(Error::NotRegular {
                    path: entry.path.to_string(),
                });
            }
        }
        self.checkout_read(commit, entries, limits)
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

#[cfg(test)]
#[path = "_tests_/repository_tests.rs"]
mod repository_tests;

impl fmt::Debug for dyn Repository + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Repository")
    }
}
