//! Root render differences prove implementation impact only with equal component inputs.

use std::collections::BTreeMap;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::canonical;
use mokly_model::catalogue::{EntryContent, ModelEntry};

use crate::material::mapped;

pub(crate) fn allows(
    previous: Option<&ModelEntry>,
    current: Option<&ModelEntry>,
    before: &PreparedCatalogue,
    after: &PreparedCatalogue,
    paths: &BTreeMap<String, String>,
) -> bool {
    match (previous, current) {
        (Some(previous), Some(current)) => {
            let (
                EntryContent::Component { visual: left, .. },
                EntryContent::Component { visual: right, .. },
            ) = (&previous.content, &current.content)
            else {
                return false;
            };
            let left_parent = previous
                .metadata
                .variant_of
                .as_ref()
                .unwrap_or(&previous.metadata.path);
            let right_parent = current
                .metadata
                .variant_of
                .as_ref()
                .unwrap_or(&current.metadata.path);
            if mapped(left_parent, paths) != *right_parent {
                return false;
            }
            canonical::to_string(&(
                &left.props,
                before.slot_fragments.get(&previous.metadata.path),
            ))
            .expect("component inputs contain only JSON props and string slot fragments")
                == canonical::to_string(&(
                    &right.props,
                    after.slot_fragments.get(&current.metadata.path),
                ))
                .expect("component inputs contain only JSON props and string slot fragments")
        }
        (Some(entry), None) | (None, Some(entry)) => {
            matches!(entry.content, EntryContent::Component { .. })
                && entry.metadata.variant_of.is_none()
        }
        (None, None) => false,
    }
}
