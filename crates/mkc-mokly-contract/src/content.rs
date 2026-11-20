//! Shared catalogue readers applied before an upload becomes public.

use mokly_model::detail_context;
use mokly_model::namespace;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::readers;
use mokly_model::usage_schemas::UsageSchemas;

use crate::error::{Rejection, Result, invalid};
use crate::index::CatalogueIndex;
use crate::limits::Limits;

/// Validated catalogue index and its publication content checks.
pub struct CatalogueContent {
    index: CatalogueIndex,
    model: CatalogueReadModel,
}

/// The source side of an ownership-listed entry detail.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DetailSource {
    /// A current detail checked against the uploaded index.
    Current,
    /// A historical detail without base-side component schemas.
    Removed,
}

/// Publication-local detail validation state.
pub struct DetailContent<'a> {
    model: &'a CatalogueReadModel,
    schemas: UsageSchemas<'a>,
    current: String,
    removed: Option<String>,
}

impl CatalogueContent {
    /// Gate the version and cloud limits, then apply the core's lenient reader.
    pub fn parse(bytes: &[u8], limits: Limits) -> Result<Self> {
        let index = CatalogueIndex::parse(bytes, limits)?;
        Self::from_index(index, bytes)
    }

    /// Apply the core reader to the exact bytes that produced the cloud index.
    pub fn from_index(index: CatalogueIndex, bytes: &[u8]) -> Result<Self> {
        let text = match str::from_utf8(bytes) {
            Ok(text) => text,
            Err(_) => return Err(invalid(Rejection::Index)),
        };
        let model = match readers::index_lenient(text) {
            Ok(model) => model,
            Err(_) => return Err(invalid(Rejection::Index)),
        };
        Ok(Self { index, model })
    }

    /// Share component schema validators across all details in this upload.
    pub fn details(&self) -> DetailContent<'_> {
        DetailContent {
            model: &self.model,
            schemas: UsageSchemas::new(&self.model.components),
            current: namespace::viewer("entries/"),
            removed: self
                .index
                .comparison_generation()
                .map(|root| format!("{root}entries/")),
        }
    }

    /// Take the cloud projection after all content checks pass.
    pub fn into_index(self) -> CatalogueIndex {
        self.index
    }
}

impl DetailContent<'_> {
    /// Identify detail files in the current or selected comparison namespace.
    pub fn source(&self, path: &str) -> Option<DetailSource> {
        if !path.ends_with(".json") {
            return None;
        }
        if path.starts_with(&self.current) {
            return Some(DetailSource::Current);
        }
        self.removed
            .as_ref()
            .filter(|root| path.starts_with(*root))
            .map(|_| DetailSource::Removed)
    }

    /// Read one detail and apply current-side context checks when available.
    pub fn validate(&mut self, bytes: &[u8], source: DetailSource) -> Result<()> {
        let text = match str::from_utf8(bytes) {
            Ok(text) => text,
            Err(_) => return Err(invalid(Rejection::Detail)),
        };
        let detail = match readers::detail_lenient(text) {
            Ok(detail) => detail,
            Err(_) => return Err(invalid(Rejection::Detail)),
        };
        if source == DetailSource::Current
            && detail_context::validate_with(&detail, self.model, &mut self.schemas).is_err()
        {
            return Err(invalid(Rejection::Detail));
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/content_tests.rs"]
mod content_tests;
