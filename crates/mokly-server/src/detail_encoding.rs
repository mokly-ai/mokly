//! Encoding boundary for changed detail payloads.

use mokly_model::canonical;
use mokly_model::public_detail::EntryDetailV4;

use crate::revision_file::RevisionFile;
use crate::snapshot::encode;

pub(crate) fn detail_id(detail: &EntryDetailV4) -> String {
    canonical::detail_id(detail)
        .expect("EntryDetailV4 has only typed JSON fields and string map keys")
}

#[cfg_attr(test, unimock::unimock(api = DetailEncoderMock))]
pub(crate) trait DetailEncoder: Send + Sync {
    fn encode(&self, detail: &EntryDetailV4) -> RevisionFile;
}

pub(crate) struct EncodedDetails;
impl DetailEncoder for EncodedDetails {
    #[tracing::instrument(name = "detail.build", skip_all)]
    fn encode(&self, detail: &EntryDetailV4) -> RevisionFile {
        RevisionFile::new(encode(detail))
    }
}
