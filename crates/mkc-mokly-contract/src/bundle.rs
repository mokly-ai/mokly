//! Validated plan request and injected receiver orchestration.

use std::io::Read;
use std::sync::Arc;

use bytes::Bytes;

use crate::archive::TarballReader;
use crate::bundle_validation;
use crate::error::Result;
use crate::index::{CatalogueIndex, INDEX_PATH};
use crate::inventory::{Inventory, MARKER_PATH};
use crate::limits::Limits;
use crate::manifest::UploadManifest;

/// Envelope path inside every export and plan archive.
pub const ENVELOPE_PATH: &str = "mokly-upload.json";

/// One artifact file carried by the plan archive, with its exact bytes.
#[derive(Clone, Debug)]
pub struct PlanArtifact {
    /// Export-relative path.
    pub path: String,
    /// Exact archived bytes; their digest and size match the marker.
    pub bytes: Bytes,
}

/// Fully validated plan request: the envelope, the ownership marker and the index.
///
/// Catalogue bytes are not present; the marker declares every file by digest.
#[derive(Debug)]
pub struct PlanBundle {
    pub(crate) manifest: UploadManifest,
    pub(crate) inventory: Inventory,
    pub(crate) index: CatalogueIndex,
    pub(crate) envelope: Bytes,
    pub(crate) marker: Bytes,
    pub(crate) index_bytes: Bytes,
}

impl PlanBundle {
    /// Validated envelope metadata.
    pub fn manifest(&self) -> &UploadManifest {
        &self.manifest
    }

    /// Every declared catalogue file, including the envelope.
    pub fn inventory(&self) -> &Inventory {
        &self.inventory
    }

    /// Validated index facts used by publication checks and screens.
    pub fn index(&self) -> &CatalogueIndex {
        &self.index
    }

    /// Exact archived index bytes, verified against the marker.
    pub fn index_bytes(&self) -> &Bytes {
        &self.index_bytes
    }

    /// The envelope, the marker and the index, in the CLI's Plan order.
    pub fn artifacts(&self) -> Vec<PlanArtifact> {
        vec![
            PlanArtifact {
                path: ENVELOPE_PATH.to_owned(),
                bytes: self.envelope.clone(),
            },
            PlanArtifact {
                path: MARKER_PATH.to_owned(),
                bytes: self.marker.clone(),
            },
            PlanArtifact {
                path: INDEX_PATH.to_owned(),
                bytes: self.index_bytes.clone(),
            },
        ]
    }
}

/// Receiver behavior injected into publication ingestion.
#[unimock::unimock(api = UploadValidatorMock)]
pub trait UploadValidator: Send + Sync {
    /// Consume and validate one authenticated compressed plan body.
    fn validate(&self, body: &mut dyn Read) -> Result<PlanBundle>;
    /// Also return a parsed envelope on rejection, without granting authority.
    fn validate_with_envelope(
        &self,
        body: &mut dyn Read,
        envelope: &mut Option<UploadManifest>,
    ) -> Result<PlanBundle>;
}

/// Validator composed with a streaming reader and receiver quotas.
pub struct ContractValidator {
    /// Reader created at the application composition root.
    pub reader: Arc<dyn TarballReader>,
    /// Quotas, bounded above by upload v3.
    pub limits: Limits,
}

impl UploadValidator for ContractValidator {
    fn validate(&self, body: &mut dyn Read) -> Result<PlanBundle> {
        let limits = self.limits;
        let files = self.reader.read(body, limits)?;
        bundle_validation::validate(files, limits)
    }

    fn validate_with_envelope(
        &self,
        body: &mut dyn Read,
        envelope: &mut Option<UploadManifest>,
    ) -> Result<PlanBundle> {
        *envelope = None;
        let files = self
            .reader
            .read_with_envelope(body, self.limits, envelope)?;
        *envelope = files
            .files()
            .get(ENVELOPE_PATH)
            .and_then(|bytes| UploadManifest::parse(bytes, self.limits).ok());
        bundle_validation::validate(files, self.limits)
    }
}

#[cfg(test)]
#[path = "_tests_/bundle_tests.rs"]
mod bundle_tests;

#[cfg(test)]
#[path = "_tests_/envelope_tests.rs"]
mod envelope_tests;

#[cfg(test)]
#[path = "_tests_/bundle_namespace_tests.rs"]
mod bundle_namespace_tests;

#[cfg(test)]
#[path = "_tests_/bundle_regressions_tests.rs"]
mod bundle_regressions_tests;

#[cfg(test)]
#[path = "_tests_/bundle_index_tests.rs"]
mod bundle_index_tests;
