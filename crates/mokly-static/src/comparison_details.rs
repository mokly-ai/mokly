//! Settled current comparison evidence and workspace projection.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_detail, projection_workspace};
use mokly_model::public_detail::EntryDetailV4;

use crate::comparison_files::compare;
use crate::error::Result;

pub(crate) fn current(
    details: &mut BTreeMap<String, EntryDetailV4>,
    result: &ComparisonResult,
) -> Result<()> {
    projection_detail::apply_evidence(details, result);
    compare(projection_workspace::apply(details, result))
}
