//! Bounded index 9 reader and immutable facts used by publication consumers.

use crate::error::{ArtifactKind, Error, Rejection, Result, invalid};
use crate::index_document::Document;
use crate::index_records::{ChangesCount, CountedRecord, Screen};
use crate::index_values::ChangesStatus;
use crate::json::{self, SchemaVersion};
use crate::limits::Limits;
use crate::{index_projection, index_validation};

/// The catalogue index carried by every Plan archive.
pub const INDEX_PATH: &str = "mokly-viewer/index.json";

/// Validated receiver read fields, without interpreting other index data.
#[derive(Debug)]
pub struct CatalogueIndex {
    pub(crate) base: Option<String>,
    pub(crate) base_commit: Option<String>,
    pub(crate) changes_status: ChangesStatus,
    pub(crate) comparison_generation: Option<String>,
    pub(crate) counted_records: Vec<CountedRecord>,
    pub(crate) current_screens: Vec<Screen>,
    pub(crate) counts: ChangesCount,
}

impl CatalogueIndex {
    /// Check quotas and index 9 before decoding the receiver's read fields.
    pub fn parse(bytes: &[u8], limits: Limits) -> Result<Self> {
        limits.check_file(bytes.len() as u64, Some(ArtifactKind::Index))?;
        match json::schema_version(bytes, 9)? {
            SchemaVersion::Missing => return Err(invalid(Rejection::Index)),
            SchemaVersion::Unsupported(version) => {
                return Err(Error::UnsupportedVersion {
                    artifact: ArtifactKind::Index,
                    version,
                });
            }
            SchemaVersion::Supported => {}
        }
        let document: Document = json::decode(bytes)?;
        index_validation::validate(&document, limits)?;
        Ok(index_projection::project(document))
    }

    /// Configured comparison ref, if the producer supplied one.
    pub fn base(&self) -> Option<&str> {
        self.base.as_deref()
    }

    /// Pinned merge base, present exactly while Changes is ready.
    pub fn base_commit(&self) -> Option<&str> {
        self.base_commit.as_deref()
    }

    /// Producer-reported Changes availability.
    pub fn changes_status(&self) -> ChangesStatus {
        self.changes_status
    }

    /// Validated artifact-relative generation root, including its trailing slash.
    pub fn comparison_generation(&self) -> Option<&str> {
        self.comparison_generation.as_deref()
    }

    /// Ready Changes counts, absent when the index has no ready comparison.
    pub fn changes_count(&self) -> Option<ChangesCount> {
        (self.changes_status == ChangesStatus::Ready).then_some(self.counts)
    }

    /// Ready, included records in check order: current kinds, then removed records.
    pub fn counted_records(&self) -> &[CountedRecord] {
        &self.counted_records
    }

    /// Current screens and variants with their views, in index order.
    pub fn current_screens(&self) -> &[Screen] {
        &self.current_screens
    }
}

#[cfg(test)]
#[path = "_tests_/index/mod.rs"]
mod index_tests;
