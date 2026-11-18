//! Encoding boundary for changed detail payloads.

use mokly_model::canonical;
use mokly_model::public_detail::EntryDetailV4;
use sha2::{Digest, Sha256};

use crate::assets::File;
use crate::detail_slot;
use crate::error::{InternalError, Result, ServerError};
use crate::revision_file::RevisionFile;

pub(crate) fn detail_id(detail: &EntryDetailV4) -> Result<String> {
    match canonical::detail_id(detail) {
        Ok(id) => Ok(id),
        Err(source) => Err(ServerError::Internal(InternalError::Provider {
            source: Box::new(source),
        })),
    }
}

#[cfg_attr(test, unimock::unimock(api = DetailEncoderMock))]
pub(crate) trait DetailEncoder: Send + Sync {
    fn encode(&self, detail: &mut EntryDetailV4) -> Result<RevisionFile>;
}

pub(crate) struct EncodedDetails;
impl DetailEncoder for EncodedDetails {
    #[tracing::instrument(name = "detail.build", skip_all)]
    fn encode(&self, detail: &mut EntryDetailV4) -> Result<RevisionFile> {
        let text = match canonical::detail_preimage(detail) {
            Ok(text) => text,
            Err(source) => {
                return Err(ServerError::Internal(InternalError::Provider {
                    source: Box::new(source),
                }));
            }
        };
        let id: String = Sha256::digest(text.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        let slot = detail_slot::range(&text)?;
        let mut bytes = text.into_bytes();
        bytes[slot].copy_from_slice(id.as_bytes());
        detail.detail_id = id;
        Ok(RevisionFile::new(File {
            bytes: bytes.into(),
            content_type: "application/json; charset=utf-8".into(),
        }))
    }
}
