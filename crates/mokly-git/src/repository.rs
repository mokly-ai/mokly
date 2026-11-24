//! Validated checkout access through bounded Git commands and immutable blobs.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::access::WorkingFile;
use crate::changes::Change;
use crate::command::{DEFAULT_OUTPUT_LIMIT, ProcessMode, Runner};
use crate::disk::Disk;
use crate::error::{Error, Result};
use crate::extracted::ExtractedFiles;
use crate::identity::{ObjectId, RepoPath};
use crate::source_key::CheckoutIdentity;
use crate::tree::{Entry, Limits, text};

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
    /// Fingerprint the regular files of an extraction of the commit under
    /// `root`, before base code can change them.
    fn fingerprint_extracted(&self, root: &Path, entries: &[Entry]) -> Result<ExtractedFiles>;
    /// Read regular commit files from a fingerprinted extraction, and through
    /// Git for each file that it lacks or that changed since its fingerprint.
    fn read_extracted(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
        limits: Limits,
        extracted: &ExtractedFiles,
    ) -> Result<Vec<Vec<u8>>>;
    /// Hash a commit file from a fingerprinted extraction, or through Git when
    /// the extraction cannot prove its bytes.
    fn digest_extracted(
        &self,
        commit: &ObjectId,
        entry: &Entry,
        extracted: &ExtractedFiles,
    ) -> Result<String>;
    /// Enumerate tracked and nonignored untracked working paths without recursion into submodules.
    fn working_paths(&self) -> Result<Vec<RepoPath>>;
    /// List index entries matching trusted Git glob pathspecs, including paths absent on disk.
    fn indexed_paths(&self, pathspecs: &[&str]) -> Result<Vec<RepoPath>>;
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
    /// Unsalted conversion identity sampled before the first base source read.
    fn checkout_identity(&self, commit: &ObjectId) -> Result<CheckoutIdentity> {
        Ok(CheckoutIdentity {
            digest: commit.to_string(),
            filtered: false,
        })
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
    /// Promisor remote names sampled once after checkout-root validation.
    pub(crate) promisor_remotes: Vec<String>,
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
        let mut repository = GitRepository {
            fetch_lock: Mutex::new(()),
            promisor_remotes: Vec::new(),
            unavailable: Mutex::new(BTreeMap::new()),
            timed_out: Mutex::new(BTreeSet::new()),
            directory: configured.clone(),
            runner: Arc::clone(&self.runner),
            disk: Arc::clone(&self.disk),
        };
        let output = repository.command_with_mode(
            ProcessMode::PlainGroup,
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
        repository.promisor_remotes = repository.read_promisor_remotes()?;
        Ok(Arc::new(repository))
    }
}

#[cfg(test)]
#[path = "_tests_/repository_tests.rs"]
mod repository_tests;

#[cfg(test)]
#[path = "_tests_/tree_requests_tests.rs"]
mod tree_requests_tests;

impl fmt::Debug for dyn Repository + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Repository")
    }
}
