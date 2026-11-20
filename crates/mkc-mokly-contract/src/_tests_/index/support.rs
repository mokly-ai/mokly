//! Index inputs shared by read-field and path boundary tests.

use serde_json::Value;

use crate::error::Result;
use crate::index::CatalogueIndex;
use crate::limits::Limits;

pub(super) fn valid() -> Value {
    serde_json::from_slice(include_bytes!("../../../fixtures/catalogue-v9.json")).unwrap()
}

pub(super) fn parse(document: &Value) -> Result<CatalogueIndex> {
    CatalogueIndex::parse(&serde_json::to_vec(document).unwrap(), Limits::default())
}
