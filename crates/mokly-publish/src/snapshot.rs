//! Prepare finalized output and retain the immutable exchange snapshot.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::Arc;

use bytes::Bytes;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::ownership::Ownership;
use mokly_model::output::upload::UploadMetadata;
use mokly_model::output::validation::{
    FILE_COUNT_LIMIT, FILE_LIMIT, INDEX, MANIFEST, MARKER, digest,
};

use crate::archive::plan_archive;
use crate::error::{Error, Result};

/// Immutable output with its prepared upload, retained together by the CLI adapter.
#[derive(Clone)]
pub struct Finalized {
    artifact: Arc<Artifact>,
    prepared: Arc<Prepared>,
}

impl Finalized {
    /// Prepare a finalized model artifact once, before returning it from the build adapter.
    pub fn new(artifact: Artifact) -> Result<Self> {
        let prepared = Arc::new(Prepared::new(&artifact)?);
        Ok(Self {
            artifact: Arc::new(artifact),
            prepared,
        })
    }

    /// Exact output bytes that the static transaction installed.
    pub fn artifact(&self) -> &Artifact {
        &self.artifact
    }
    /// Finalized hashes, typed metadata and compressed Plan body.
    pub fn prepared(&self) -> &Prepared {
        &self.prepared
    }
}

/// Finished output boundary; captures share prepared bytes without hashing or compression.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = OutputSnapshotMock))]
pub trait OutputSnapshot: Send + Sync {
    /// Return the installed artifact and its already prepared upload.
    fn capture(&self) -> Result<Finalized>;
}

impl OutputSnapshot for Finalized {
    fn capture(&self) -> Result<Finalized> {
        Ok(self.clone())
    }
}

/// Validated immutable exchange input.
pub struct Prepared {
    /// Output directory retained for the caller.
    pub directory: PathBuf,
    /// Validated upload envelope.
    pub metadata: UploadMetadata,
    /// Marker entries used for digest membership and accounting.
    pub ownership: Ownership,
    /// Compressed Plan body, shared by every request round.
    pub archive: Bytes,
    /// Exact Plan files in their required order.
    pub plan_files: Vec<File>,
    /// Exact bytes for each distinct digest, including the marker.
    pub blobs: BTreeMap<String, Bytes>,
}

impl Prepared {
    /// Enforce upload limits, reuse finalized identities, and compress once.
    pub fn new(artifact: &Artifact) -> Result<Self> {
        if artifact.files.len() > FILE_COUNT_LIMIT
            || artifact
                .files
                .iter()
                .any(|file| file.bytes.len() > FILE_LIMIT)
        {
            return Err(Error::TooLarge);
        }
        let by_path: BTreeMap<_, _> = artifact
            .files
            .iter()
            .map(|file| (file.path.as_str(), file))
            .collect();
        let marker = by_path[MARKER];
        let ownership = artifact.ownership.clone();
        let manifest = by_path[MANIFEST];
        let metadata = artifact
            .metadata
            .clone()
            .expect("The publication build finalizes its artifact with upload metadata");
        let mut blobs = BTreeMap::from([(digest(&marker.bytes), marker.bytes.clone())]);
        for entry in &ownership.files {
            let file = by_path[entry.path.as_str()];
            blobs.insert(entry.sha256.clone(), file.bytes.clone());
        }
        let index = by_path[INDEX];
        let plan_files = vec![manifest.clone(), marker.clone(), index.clone()];
        let archive = plan_archive(&plan_files)?.into();
        Ok(Self {
            directory: artifact.directory.clone(),
            metadata,
            ownership,
            archive,
            plan_files,
            blobs,
        })
    }

    /// Distinct marker digests; the marker itself is not a marker entry.
    pub fn digests(&self) -> BTreeSet<String> {
        self.ownership
            .files
            .iter()
            .map(|entry| entry.sha256.clone())
            .collect()
    }
}
