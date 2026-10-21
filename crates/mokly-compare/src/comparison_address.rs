//! Shared review addresses preserve saved props and supplied slot metadata.

use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::review::ReviewEntryAddress;
use mokly_model::wire_props;

pub(crate) fn address(entry: &ModelEntry) -> ReviewEntryAddress {
    let props = match &entry.content {
        EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
            Some(wire_props::encode(&visual.props))
        }
        _ => None,
    };
    let supplied_slots = match &entry.content {
        EntryContent::Component { supplied_slots, .. } => Some(supplied_slots.clone()),
        _ => None,
    };
    ReviewEntryAddress {
        path: entry.metadata.path.clone(),
        title: entry.metadata.title.clone(),
        props,
        supplied_slots,
    }
}
