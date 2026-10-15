//! Upload metadata v2, constructed before static ownership finalization.

use serde::{Deserialize, Deserializer, Serialize};

use crate::error::{Error, Result};
use crate::identity::Repository;
use crate::json::unique;
use crate::numbers;
use crate::semver;
use crate::validation::{MANIFEST_LIMIT, hexadecimal, portable_path, text, timestamp};

/// The pinned comparison selected by the static builder.
#[derive(Clone, Debug)]
pub struct Comparison {
    /// Effective configured or explicit base ref.
    pub base_ref: String,
    /// Full merge-base object id, never the base ref's current tip.
    pub base_sha: String,
    /// Exact generation review path; no newest-file lookup is allowed.
    pub path: String,
}

/// Finalization inputs supplied by the static output inventory.
#[derive(Clone, Debug)]
pub struct BuildInventory {
    /// Portable path from the Git root to the resolved configuration.
    pub config_path: String,
    /// Exact UTC millisecond finalization timestamp.
    pub exported_at: String,
    /// Included comparison, absent for current-only output.
    pub comparison: Option<Comparison>,
}

/// Git identity pinned before the build starts.
#[derive(Clone, Debug)]
pub struct Publication {
    /// Installed package SemVer, including build metadata.
    pub mokly_version: String,
    /// Detected or explicit repository identity.
    pub repository: Repository,
    /// Symbolic or Actions branch name.
    pub branch: String,
    /// Actual checked-out committed revision.
    pub head_sha: String,
    /// Optional Actions pull request number.
    pub pull_request: Option<u64>,
}

/// The exact metadata envelope stored at mokly-upload.json.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UploadMetadata {
    /// Independent envelope version, always 2.
    #[serde(deserialize_with = "numbers::version")]
    pub schema_version: u8,
    /// Installed Mokly package SemVer.
    pub mokly_version: String,
    /// Repository assertion for receiver authorization.
    pub repository: Repository,
    /// Branch name without control characters.
    pub branch: String,
    /// Full lowercase Git object id.
    pub head_sha: String,
    /// Effective base ref or explicit null.
    #[serde(deserialize_with = "nullable")]
    pub base_ref: Option<String>,
    /// Pinned merge base or explicit null.
    #[serde(deserialize_with = "nullable")]
    pub base_sha: Option<String>,
    /// Positive JavaScript-safe number or explicit null.
    #[serde(deserialize_with = "numbers::pull_request")]
    pub pull_request: Option<u64>,
    /// Root-relative configuration path.
    pub config_path: String,
    /// UTC timestamp with exactly millisecond precision.
    pub exported_at: String,
    /// One pinned generation review path or explicit null.
    #[serde(deserialize_with = "nullable")]
    pub comparison_path: Option<String>,
}

fn nullable<'de, T: Deserialize<'de>, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<T>, D::Error> {
    Option::<T>::deserialize(deserializer)
}

impl Publication {
    /// Build metadata from the finalized output inventory, before hashing it.
    pub fn metadata(&self, inventory: &BuildInventory) -> Result<UploadMetadata> {
        let document = UploadMetadata {
            schema_version: 2,
            mokly_version: self.mokly_version.clone(),
            repository: self.repository.clone(),
            branch: self.branch.clone(),
            head_sha: self.head_sha.clone(),
            base_ref: inventory
                .comparison
                .as_ref()
                .map(|base| base.base_ref.clone()),
            base_sha: inventory
                .comparison
                .as_ref()
                .map(|base| base.base_sha.clone()),
            pull_request: self.pull_request,
            config_path: inventory.config_path.clone(),
            exported_at: inventory.exported_at.clone(),
            comparison_path: inventory.comparison.as_ref().map(|base| base.path.clone()),
        };
        document.validate()?;
        Ok(document)
    }
}

impl UploadMetadata {
    /// Parse the envelope with exact fields, unique keys, and bounded bytes.
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        if bytes.len() > MANIFEST_LIMIT {
            return Err(Error::TooLarge);
        }
        let value = unique(bytes)?;
        let Some(version) = value
            .as_object()
            .and_then(|object| object.get("schemaVersion"))
        else {
            return Err(Error::InvalidBundle);
        };
        if version.as_f64() != Some(2.0) {
            return Err(Error::UnsupportedVersion);
        }
        let Ok(metadata) = serde_json::from_value::<Self>(value) else {
            return Err(Error::InvalidBundle);
        };
        metadata.validate()?;
        Ok(metadata)
    }

    /// Validate a constructed document before it enters the output inventory.
    pub fn validate(&self) -> Result<()> {
        if self.schema_version != 2 {
            return Err(Error::UnsupportedVersion);
        }
        if self.repository.validate().is_err()
            || !text(&self.mokly_version, 255)
            || !semver::valid(&self.mokly_version)
            || !text(&self.branch, 255)
            || !hexadecimal(&self.head_sha, &[40, 64])
            || self
                .pull_request
                .is_some_and(|number| !(1..=9_007_199_254_740_991).contains(&number))
        {
            return Err(Error::InvalidBundle);
        }
        portable_path(&self.config_path)?;
        timestamp(&self.exported_at)?;
        match (&self.base_ref, &self.base_sha, &self.comparison_path) {
            (None, None, None) => Ok(()),
            (Some(reference), Some(sha), Some(path))
                if text(reference, 255) && hexadecimal(sha, &[40, 64]) =>
            {
                let generation = path
                    .strip_prefix("mokly-viewer/diffs/generations/")
                    .and_then(|path| path.strip_suffix("/review.json"));
                if generation.is_some_and(|generation| hexadecimal(generation, &[64])) {
                    Ok(())
                } else {
                    Err(Error::InvalidBundle)
                }
            }
            _ => Err(Error::InvalidBundle),
        }
    }

    /// Serialize only documented fields, with a final newline.
    pub fn bytes(&self) -> Result<Vec<u8>> {
        self.validate()?;
        let Ok(mut bytes) = serde_json::to_vec_pretty(self) else {
            return Err(Error::InvalidBundle);
        };
        bytes.push(b'\n');
        if bytes.len() > MANIFEST_LIMIT {
            return Err(Error::TooLarge);
        }
        Ok(bytes)
    }
}
