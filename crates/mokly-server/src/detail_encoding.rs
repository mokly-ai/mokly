//! Validation and encoding boundary for changed detail payloads.

use mokly_model::canonical;
use mokly_model::public_detail::EntryDetailV4;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::usage_schemas::UsageSchemas;

use crate::error::{InternalError, Result};
use crate::revision_file::RevisionFile;
use crate::snapshot::encode;

pub(crate) fn detail_id(detail: &EntryDetailV4) -> Result<String> {
    match canonical::detail_id(detail) {
        Ok(id) => Ok(id),
        Err(source) => Err(InternalError::Model { source }.into()),
    }
}

#[cfg_attr(test, unimock::unimock(api = DetailEncoderMock))]
pub(crate) trait DetailEncoder: Send + Sync {
    fn encode(
        &self,
        detail: &EntryDetailV4,
        index: &CatalogueReadModel,
        schemas: &mut UsageSchemas<'_>,
    ) -> Result<RevisionFile>;
}

pub(crate) struct ValidatedDetails;
impl DetailEncoder for ValidatedDetails {
    #[tracing::instrument(name = "detail.build", skip_all, err)]
    fn encode(
        &self,
        detail: &EntryDetailV4,
        index: &CatalogueReadModel,
        schemas: &mut UsageSchemas<'_>,
    ) -> Result<RevisionFile> {
        if let Err(source) = mokly_model::detail_context::validate_with(detail, index, schemas) {
            return Err(InternalError::Read { source }.into());
        }
        RevisionFile::new(encode(detail)?)
    }
}
