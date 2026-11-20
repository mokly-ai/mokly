//! Visible owned capacities of one flattened annotation record.

use std::mem;

use crate::document_annotations::AttributeRecord;
use crate::document_capacity;
use crate::document_nodes::FlatNode;

impl FlatNode {
    pub(crate) fn known_bytes(&self) -> usize {
        match self {
            Self::Text(value) | Self::Comment(value) | Self::Doctype(value) => value.capacity(),
            Self::Region { region, .. } => region.known_bytes(),
            Self::Element {
                style_owners,
                style_attribution,
                origin,
                navigation,
                source,
                name,
                namespace,
                attributes,
                ..
            } => {
                style_owners.as_ref().map_or(0, document_capacity::strings)
                    + style_attribution.as_ref().map_or(0, |values| {
                        values.capacity() * mem::size_of::<(String, Vec<String>)>()
                            + values
                                .iter()
                                .map(|(css, owners)| {
                                    css.capacity() + document_capacity::strings(owners)
                                })
                                .sum::<usize>()
                    })
                    + origin.as_ref().map_or(0, String::capacity)
                    + navigation.as_ref().map_or(0, |value| value.known_bytes())
                    + source.as_ref().map_or(0, |value| value.known_bytes())
                    + name.capacity()
                    + namespace.capacity()
                    + attributes.capacity() * mem::size_of::<AttributeRecord>()
                    + attributes
                        .iter()
                        .map(AttributeRecord::known_bytes)
                        .sum::<usize>()
            }
        }
    }
}
