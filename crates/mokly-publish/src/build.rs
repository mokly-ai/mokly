//! Static output and private directory boundaries for the publish command.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::error::{Error, InternalError, Result};
use crate::metadata::Publication;
use crate::runtime::Cancellation;
use crate::snapshot::OutputSnapshot;

/// Inputs pinned before static output generation.
#[derive(Clone, Debug)]
pub struct BuildRequest {
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
    /// Effective policy, resolved by warnings_are_fatal.
    pub warnings_are_fatal: bool,
    /// Inspected revision and repository metadata used for envelope finalization.
    pub publication: Publication,
}

/// Static output transaction, filled by mokly-static in the later milestone.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StaticOutputMock))]
pub trait StaticOutput: Send + Sync {
    /// Build, install, and return the same finalized bytes without reading them back.
    fn build(
        &self,
        request: &BuildRequest,
        cancellation: &dyn Cancellation,
    ) -> Result<Arc<dyn OutputSnapshot>>;
}

/// Explicit unavailable state until the static output implementation exists.
pub struct UnavailableOutput;

impl StaticOutput for UnavailableOutput {
    fn build(
        &self,
        _: &BuildRequest,
        cancellation: &dyn Cancellation,
    ) -> Result<Arc<dyn OutputSnapshot>> {
        if cancellation.is_cancelled() {
            return Err(Error::Cancelled);
        }
        Err(Error::StaticUnavailable)
    }
}

/// Private build directory allocation, never tied to automatic upload cleanup.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DirectoriesMock))]
pub trait Directories: Send + Sync {
    /// Reserve a new private directory outside the real repository root.
    fn create(&self, repository_root: &Path) -> Result<PathBuf>;
}

/// Host directory allocator. The output survives both command success and failure.
pub struct SystemDirectories;

impl Directories for SystemDirectories {
    fn create(&self, repository_root: &Path) -> Result<PathBuf> {
        let parent = match std::env::temp_dir().canonicalize() {
            Ok(parent) => parent,
            Err(source) => return Err(Error::Internal(InternalError::Directory { source })),
        };
        if parent.starts_with(repository_root) {
            return Err(Error::Internal(InternalError::DirectoryInsideRepository {
                directory: parent,
            }));
        }
        let directory = match tempfile::Builder::new()
            .prefix("mokly-publish-")
            .tempdir_in(&parent)
        {
            Ok(directory) => directory,
            Err(source) => return Err(Error::Internal(InternalError::Directory { source })),
        };
        let real = match directory.path().canonicalize() {
            Ok(directory) => directory,
            Err(source) => return Err(Error::Internal(InternalError::Directory { source })),
        };
        if real.starts_with(repository_root) {
            return Err(Error::Internal(InternalError::DirectoryInsideRepository {
                directory: real,
            }));
        }
        Ok(directory.keep())
    }
}

/// One policy switch for the pending publish warning decision.
/// The specified policy makes all publish warnings fatal, with or without --strict.
pub fn warnings_are_fatal(_strict: bool) -> bool {
    true
}
