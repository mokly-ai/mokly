//! Capacity accounting for an admitted root, without temporary JSON encodings.

use std::mem;

use mokly_html::fragment::{
    Fragment, FragmentMarker, FragmentMarkerKind, OwnedStyle, StyleAttribution,
};

use crate::{document_usage, document_weight};

pub(crate) fn retained(value: &Fragment) -> usize {
    mem::size_of::<Fragment>()
        + value.html.capacity()
        + value.markers.capacity() * mem::size_of::<FragmentMarker>()
        + value
            .markers
            .iter()
            .map(|marker| {
                marker.id.capacity()
                    + marker.parent_id.as_ref().map_or(0, String::capacity)
                    + match &marker.kind {
                        FragmentMarkerKind::Output => 0,
                        FragmentMarkerKind::Instance { key } | FragmentMarkerKind::Slot { key } => {
                            key.capacity()
                        }
                        FragmentMarkerKind::Ignore { material_key } => {
                            material_key.as_ref().map_or(0, String::capacity)
                        }
                        FragmentMarkerKind::Link { to } => to.capacity(),
                    }
            })
            .sum::<usize>()
        + document_usage::instance_records(&value.instances)
        + document_usage::slot_records(&value.slots)
        + document_weight::warnings(&value.warnings)
        + document_weight::strings(&value.resources)
        + value.styles.capacity() * mem::size_of::<OwnedStyle>()
        + value
            .styles
            .iter()
            .map(|style| {
                style.css.capacity()
                    + document_weight::strings(&style.owners)
                    + style.attribution.as_ref().map_or(0, |records| {
                        records.capacity() * mem::size_of::<StyleAttribution>()
                            + records
                                .iter()
                                .map(|record| {
                                    record.css.capacity() + document_weight::strings(&record.owners)
                                })
                                .sum::<usize>()
                    })
            })
            .sum::<usize>()
}
