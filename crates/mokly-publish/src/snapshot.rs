//! Frozen static output: validation never re-walks a mutable output directory.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use bytes::Bytes;
use serde::Deserialize;

use crate::archive::plan_archive;
use crate::error::{Error, Result};
use crate::json::unique;
use crate::metadata::{BuildInventory, Publication, UploadMetadata};
use crate::ownership::{Entry, Ownership};
use crate::validation::{FILE_COUNT_LIMIT, FILE_LIMIT, MANIFEST, MARKER, digest};

/// One regular file's immutable final bytes.
#[derive(Clone, Debug)]
pub struct File {
    /// Portable root-relative path.
    pub path: String,
    /// Exact bytes installed by the static output transaction.
    pub bytes: Bytes,
}

/// Finished output and its complete byte snapshot, including its marker.
#[derive(Clone, Debug)]
pub struct Artifact {
    /// Installed private directory, retained after a failed upload.
    pub directory: PathBuf,
    /// Inventory of exactly the files in that directory.
    pub files: Vec<File>,
}

/// Static builder integration seam. Implementations return their finalized snapshot.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = OutputSnapshotMock))]
pub trait OutputSnapshot: Send + Sync {
    /// Return frozen bytes captured during finalization, without reading the output back.
    fn capture(&self) -> Result<Artifact>;
}

impl OutputSnapshot for Artifact {
    fn capture(&self) -> Result<Artifact> {
        Ok(self.clone())
    }
}

/// Validated immutable exchange input.
pub struct Prepared {
    /// Output location retained for the caller.
    pub directory: PathBuf,
    /// Validated envelope.
    pub metadata: UploadMetadata,
    /// Marker entries used for digest membership and accounting.
    pub ownership: Ownership,
    /// Compressed Plan body, identical for every round.
    pub archive: Bytes,
    /// Exact Plan files, in their required order.
    pub plan_files: Vec<File>,
    /// Each distinct digest's exact bytes, including the marker.
    pub blobs: BTreeMap<String, Bytes>,
}

impl Artifact {
    /// Add publication metadata, then ownership, to a static builder's captured files.
    /// The builder installs these bytes and returns this same snapshot to publish.
    pub fn finalize(
        directory: PathBuf,
        publication: &Publication,
        inventory: &BuildInventory,
        mut files: Vec<File>,
    ) -> Result<Self> {
        let metadata = publication.metadata(inventory)?;
        files.push(File {
            path: MANIFEST.to_owned(),
            bytes: metadata.bytes()?.into(),
        });
        files.sort_by(|left, right| left.path.encode_utf16().cmp(right.path.encode_utf16()));
        let ownership = Ownership {
            schema_version: 3,
            files: files
                .iter()
                .map(|file| Entry {
                    path: file.path.clone(),
                    sha256: digest(&file.bytes),
                    size: file.bytes.len() as u64,
                })
                .collect(),
        };
        let Ok(mut marker) = serde_json::to_vec_pretty(&ownership) else {
            return Err(Error::InvalidBundle);
        };
        marker.push(b'\n');
        Ownership::parse(&marker)?;
        files.push(File {
            path: MARKER.to_owned(),
            bytes: marker.into(),
        });
        let artifact = Self { directory, files };
        artifact.prepare()?;
        Ok(artifact)
    }

    /// Validate completeness, addresses, metadata and comparison before any request.
    pub fn prepare(&self) -> Result<Prepared> {
        if self.files.len() > FILE_COUNT_LIMIT
            || self.files.iter().any(|file| file.bytes.len() > FILE_LIMIT)
        {
            return Err(Error::TooLarge);
        }
        let mut by_path = BTreeMap::new();
        for file in &self.files {
            if by_path.insert(file.path.as_str(), file).is_some() {
                return Err(Error::InvalidBundle);
            }
        }
        let marker = by_path.get(MARKER).ok_or(Error::InvalidBundle)?;
        let ownership = Ownership::parse(&marker.bytes)?;
        let manifest = by_path.get(MANIFEST).ok_or(Error::InvalidBundle)?;
        let metadata = UploadMetadata::parse(&manifest.bytes)?;
        if !by_path.contains_key("index.html")
            || !by_path.contains_key("404.html")
            || by_path.len() != ownership.files.len() + 1
        {
            return Err(Error::InvalidBundle);
        }
        let mut blobs = BTreeMap::from([(digest(&marker.bytes), marker.bytes.clone())]);
        for entry in &ownership.files {
            let file = by_path
                .get(entry.path.as_str())
                .ok_or(Error::InvalidBundle)?;
            if file.bytes.len() as u64 != entry.size || digest(&file.bytes) != entry.sha256 {
                return Err(Error::InvalidBundle);
            }
            blobs.insert(entry.sha256.clone(), file.bytes.clone());
        }
        let mut plan_files = vec![(*manifest).clone(), (*marker).clone()];
        match &metadata.comparison_path {
            Some(path) => {
                let review = by_path.get(path.as_str()).ok_or(Error::InvalidBundle)?;
                let Ok(identity) = serde_json::from_value::<ReviewIdentity>(unique(&review.bytes)?)
                else {
                    return Err(Error::InvalidBundle);
                };
                if identity.schema_version != 8.0
                    || Some(&identity.base_ref) != metadata.base_ref.as_ref()
                    || Some(&identity.base_commit) != metadata.base_sha.as_ref()
                {
                    return Err(Error::InvalidBundle);
                }
                plan_files.push((*review).clone());
            }
            None => {
                if by_path
                    .keys()
                    .any(|path| path.starts_with("mokly-viewer/diffs/"))
                {
                    return Err(Error::InvalidBundle);
                }
            }
        }
        let archive = plan_archive(&plan_files)?;
        Ok(Prepared {
            directory: self.directory.clone(),
            metadata,
            ownership,
            archive: archive.into(),
            plan_files,
            blobs,
        })
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewIdentity {
    schema_version: f64,
    base_ref: String,
    base_commit: String,
}

impl Prepared {
    /// Distinct inventory digests; the marker itself is not a marker entry.
    pub fn digests(&self) -> BTreeSet<String> {
        self.ownership
            .files
            .iter()
            .map(|entry| entry.sha256.clone())
            .collect()
    }
}
