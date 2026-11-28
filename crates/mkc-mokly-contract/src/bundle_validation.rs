//! Plan archive checks: exact artifacts, declared digests and declared-path policy.

use std::collections::BTreeSet;

use bytes::Bytes;
use sha2::{Digest, Sha256};

use crate::archive::ArchiveFiles;
use crate::bundle::{ENVELOPE_PATH, PlanBundle};
use crate::error::{Error, Limit, Rejection, Result, invalid};
use crate::index::{CatalogueIndex, INDEX_PATH};
use crate::index_values::ChangesStatus;
use crate::inventory::{Inventory, MARKER_PATH};
use crate::limits::Limits;
use crate::manifest::UploadManifest;
use crate::paths;
use crate::scanned_archive::ScannedArchive;

const DIFFS: &str = "mokly-viewer/diffs";

pub(crate) fn validate(archive: ScannedArchive, limits: Limits) -> Result<PlanBundle> {
    let ScannedArchive {
        files, directories, ..
    } = archive;
    let envelope = required(&files, ENVELOPE_PATH)?;
    let marker = required(&files, MARKER_PATH)?;
    UploadManifest::probe(&envelope, limits)?;
    let inventory = Inventory::parse(&marker, limits)?;
    let declared_bytes = inventory
        .files
        .iter()
        .try_fold(0_u64, |total, file| total.checked_add(file.size));
    if declared_bytes.is_none_or(|total| total > limits.declared()) {
        return Err(Error::TooLarge {
            limit: Limit::DeclaredBytes,
        });
    }
    let manifest = UploadManifest::parse(&envelope, limits)?;
    let index_bytes = required(&files, INDEX_PATH)?;
    let expected: BTreeSet<&str> = [ENVELOPE_PATH, MARKER_PATH, INDEX_PATH]
        .into_iter()
        .collect();
    if directories != 0
        || !files
            .keys()
            .map(String::as_str)
            .eq(expected.iter().copied())
    {
        return Err(invalid(Rejection::PlanFiles));
    }
    verify(&inventory, ENVELOPE_PATH, &envelope)?;
    verify(&inventory, INDEX_PATH, &index_bytes)?;
    let index = CatalogueIndex::parse(&index_bytes, limits)?;
    let declared: BTreeSet<&str> = inventory.files.iter().map(|f| f.path.as_str()).collect();
    for path in ["index.html", "404.html"] {
        if !declared.contains(path) {
            return Err(invalid(Rejection::MissingFile));
        }
    }
    if declared.iter().any(|path| paths::private(path)) {
        return Err(invalid(Rejection::PrivateFile));
    }
    // Only these roots are reserved. Fixed Mokly segments have no `_` prefix,
    // and other underscore-prefixed authored segments stay valid.
    if declared.iter().any(|path| {
        path.split('/').next().is_some_and(|root| {
            ["_access", "__blobs", "__mokly"]
                .iter()
                .any(|reserved| root.eq_ignore_ascii_case(reserved))
        })
    }) {
        return Err(invalid(Rejection::Path));
    }
    comparison(&declared, &manifest, &index)?;
    Ok(PlanBundle {
        manifest,
        inventory,
        index,
        envelope,
        marker,
        index_bytes,
    })
}

fn required(files: &ArchiveFiles, path: &str) -> Result<Bytes> {
    files
        .get(path)
        .cloned()
        .ok_or_else(|| invalid(Rejection::MissingFile))
}

/// The archived artifact must equal its declaration in digest and size.
fn verify(inventory: &Inventory, path: &str, bytes: &[u8]) -> Result<()> {
    let entry = inventory
        .entry(path)
        .ok_or_else(|| invalid(Rejection::MissingFile))?;
    let digest = hex(&Sha256::digest(bytes));
    if entry.size != bytes.len() as u64 || entry.sha256 != digest {
        return Err(invalid(Rejection::ArtifactDigest));
    }
    Ok(())
}

fn comparison(
    declared: &BTreeSet<&str>,
    manifest: &UploadManifest,
    index: &CatalogueIndex,
) -> Result<()> {
    let mut diffs = declared.iter().filter(|path| {
        let lowercase = path.to_ascii_lowercase();
        lowercase == DIFFS || lowercase.starts_with("mokly-viewer/diffs/")
    });
    let Some(commit) = &manifest.base_sha else {
        if index.base_commit().is_some()
            || index.comparison_generation().is_some()
            || !matches!(
                index.changes_status(),
                ChangesStatus::Disabled | ChangesStatus::Unavailable
            )
        {
            return Err(invalid(Rejection::ComparisonMetadata));
        }
        if diffs.next().is_some() {
            return Err(invalid(Rejection::ComparisonFiles));
        }
        return Ok(());
    };
    if index.changes_status() != ChangesStatus::Ready
        || index.base_commit() != Some(commit.as_str())
        || index.base() != manifest.base_ref.as_deref()
    {
        return Err(invalid(Rejection::ComparisonMetadata));
    }
    let root = index
        .comparison_generation()
        .ok_or_else(|| invalid(Rejection::ComparisonMetadata))?;
    if diffs.any(|diff| !diff.starts_with(root)) {
        return Err(invalid(Rejection::ComparisonFiles));
    }
    Ok(())
}

fn hex(digest: &[u8]) -> String {
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}
