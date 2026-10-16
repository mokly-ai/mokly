//! Static output and private directory boundaries for the publish command.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_model::output::upload::Publication;
use mokly_publish::runtime::Cancellation;
use mokly_publish::snapshot::OutputSnapshot;

use crate::publication::error::{DirectoryFailure, Error, Result};

/// Inputs pinned before static output generation.
#[derive(Clone, Debug)]
pub struct BuildRequest {
    /// Invocation directory for upward config discovery and relative --config.
    pub invocation_directory: PathBuf,
    /// Git repository root for metadata and confinement.
    pub repository_root: PathBuf,
    /// Private output directory outside the repository.
    pub directory: PathBuf,
    /// Explicit configuration, or normal upward discovery.
    pub config: Option<PathBuf>,
    /// Explicit base ref; the static builder otherwise uses review.base.
    pub base: Option<String>,
    /// Current-only output performs no base lookup.
    pub no_changes: bool,
    /// The user explicitly requested --strict.
    pub strict: bool,
    /// Effective policy, resolved by warnings_are_fatal.
    pub warnings_are_fatal: bool,
    /// Inspected revision and repository metadata used for envelope finalization.
    pub publication: Publication,
}

/// Static output transaction composed from mokly-static at the CLI root.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StaticOutputMock))]
pub trait StaticOutput: Send + Sync {
    /// Build, install, and return the same finalized bytes without reading them back.
    fn build(
        &self,
        request: &BuildRequest,
        cancellation: &dyn Cancellation,
    ) -> Result<Arc<dyn OutputSnapshot>>;
}

/// Private build directory allocation, never tied to automatic upload cleanup.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DirectoriesMock))]
pub trait Directories: Send + Sync {
    /// Reserve a private parent outside the repository and return its absent site child.
    fn create(&self, repository_root: &Path) -> Result<PathBuf>;
}

/// Host directory allocator. The output survives both command success and failure.
pub struct SystemDirectories;

impl Directories for SystemDirectories {
    fn create(&self, repository_root: &Path) -> Result<PathBuf> {
        let requested: PathBuf = std::env::temp_dir().components().collect();
        let parent = match dunce::canonicalize(&requested) {
            Ok(parent) => parent,
            Err(source) => return Err(directory_error(requested, source)),
        };
        let repository_root = match dunce::canonicalize(repository_root) {
            Ok(root) => root,
            Err(source) => return Err(directory_error(parent, source)),
        };
        if parent.starts_with(&repository_root) {
            return Err(Error::Directory {
                temporary_root: parent,
                reason: DirectoryFailure::InsideRepository,
            });
        }
        let directory = match tempfile::Builder::new()
            .prefix("mokly-publish-")
            .tempdir_in(&parent)
        {
            Ok(directory) => directory,
            Err(source) => return Err(directory_error(parent, source)),
        };
        let real = match dunce::canonicalize(directory.path()) {
            Ok(directory) => directory,
            Err(source) => return Err(directory_error(parent, source)),
        };
        if real.starts_with(&repository_root) {
            return Err(Error::Directory {
                temporary_root: parent,
                reason: DirectoryFailure::InsideRepository,
            });
        }
        let _retained = directory.keep();
        Ok(real.join("site"))
    }
}

/// One policy switch for the pending publish warning decision.
/// The specified policy makes all publish warnings fatal, with or without --strict.
pub fn warnings_are_fatal(_strict: bool) -> bool {
    true
}

fn directory_error(temporary_root: PathBuf, source: std::io::Error) -> Error {
    Error::Directory {
        temporary_root,
        reason: DirectoryFailure::Unavailable { source },
    }
}
