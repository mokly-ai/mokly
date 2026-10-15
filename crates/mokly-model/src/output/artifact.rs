//! Finalized byte inventory and the single ownership marker writer.

use std::path::PathBuf;

use bytes::Bytes;

use crate::output::error::{FormatError, Result};
use crate::output::ownership::{Entry, Ownership};
use crate::output::upload::UploadMetadata;
use crate::output::validation::{FILE_LIMIT, MANIFEST, MARKER, digest};
use crate::versions::EXPORT_OWNERSHIP;

/// One regular file's immutable final bytes.
#[derive(Clone, Debug)]
pub struct File {
    /// Portable path relative to the output directory.
    pub path: String,
    /// Exact bytes installed by the static output transaction.
    pub bytes: Bytes,
}

/// Finalized output and its complete byte inventory, including the marker.
#[derive(Clone, Debug)]
pub struct Artifact {
    /// Installed output directory, without filesystem authority from its inventory.
    pub directory: PathBuf,
    /// Every regular output file, with the ownership marker last.
    pub files: Vec<File>,
}

impl Artifact {
    /// Add optional publication metadata, then write the shared ownership marker.
    /// Plain builds pass None. Publication builds pass their validated envelope.
    /// This pure writer performs no archive compression or upload preparation.
    pub fn finalize(
        directory: PathBuf,
        mut files: Vec<File>,
        metadata: Option<UploadMetadata>,
    ) -> Result<Self> {
        if let Some(metadata) = metadata {
            files.push(File {
                path: MANIFEST.to_owned(),
                bytes: metadata.bytes()?.into(),
            });
        }
        if files.iter().any(|file| file.bytes.len() > FILE_LIMIT) {
            return Err(FormatError::TooLarge);
        }
        files.sort_by(|left, right| left.path.encode_utf16().cmp(right.path.encode_utf16()));
        let ownership = Ownership {
            schema_version: EXPORT_OWNERSHIP,
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
            return Err(FormatError::InvalidBundle);
        };
        marker.push(b'\n');
        Ownership::parse(&marker)?;
        files.push(File {
            path: MARKER.to_owned(),
            bytes: marker.into(),
        });
        Ok(Self { directory, files })
    }
}

#[cfg(test)]
#[path = "_tests_/artifact_tests.rs"]
mod artifact_tests;
