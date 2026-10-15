//! Validation and encoding boundary for changed detail payloads.

use mokly_model::public_detail::EntryDetailV1;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::usage_schemas::UsageSchemas;

use crate::error::{InternalError, Result};
use crate::revision_file::RevisionFile;
use crate::snapshot::encode;

#[cfg_attr(test, unimock::unimock(api = DetailEncoderMock))]
pub(crate) trait DetailEncoder: Send + Sync {
    fn encode(
        &self,
        detail: &EntryDetailV1,
        index: &CatalogueReadModel,
        schemas: &mut UsageSchemas<'_>,
    ) -> Result<RevisionFile>;
}

pub(crate) struct ValidatedDetails;
impl DetailEncoder for ValidatedDetails {
    #[tracing::instrument(name = "detail.build", skip_all, err)]
    fn encode(
        &self,
        detail: &EntryDetailV1,
        index: &CatalogueReadModel,
        schemas: &mut UsageSchemas<'_>,
    ) -> Result<RevisionFile> {
        if let Err(source) = mokly_model::detail_context::validate_with(detail, index, schemas) {
            return Err(InternalError::Read { source }.into());
        }
        RevisionFile::new(encode(detail)?)
    }
}
