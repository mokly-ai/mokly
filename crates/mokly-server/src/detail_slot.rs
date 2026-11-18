//! Locate only the top-level detail identity token in a canonical JSON object.

use std::ops::Range;

use serde::Deserialize;
use serde_json::value::RawValue;

use crate::error::{InternalError, Result, ServerError};

#[derive(Deserialize)]
struct DetailSlot<'a> {
    #[serde(borrow, rename = "detailId")]
    id: &'a RawValue,
}

pub(crate) fn range(text: &str) -> Result<Range<usize>> {
    let slot: DetailSlot<'_> = match serde_json::from_str(text) {
        Ok(slot) => slot,
        Err(source) => return Err(ServerError::Internal(InternalError::Json { source })),
    };
    let value = slot.id.get();
    if value.len() != 66
        || !value.starts_with('"')
        || !value.ends_with('"')
        || !value.as_bytes()[1..65].iter().all(|byte| *byte == b'0')
    {
        return Err(ServerError::Internal(
            InternalError::CanonicalDetailIdentity,
        ));
    }
    let start = value.as_ptr() as usize - text.as_ptr() as usize + 1;
    Ok(start..start + 64)
}
