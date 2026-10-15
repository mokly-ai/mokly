//! Generated marker metadata authenticates payloads and physical parent relationships.

use mokly_model::usage::ComponentSlotRecord;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::{Fragment, FragmentMarkerKind};
use crate::marker_syntax::{Marker, required};

pub(crate) fn start(marker: &Marker, fragment: &Fragment, parent: Option<&str>) -> Result<()> {
    let record = fragment
        .markers
        .iter()
        .find(|record| record.id == marker.id)
        .ok_or_else(|| {
            invalid(
                Code::BuildInvalid,
                "fragment marker has no authenticated placement",
            )
        })?;
    if record.parent_id.as_deref() != parent {
        return Err(invalid(
            Code::BuildInvalid,
            "fragment marker has the wrong parent",
        ));
    }
    let valid = match &record.kind {
        FragmentMarkerKind::Output => marker.kind == "output",
        FragmentMarkerKind::Instance { key } => {
            marker.kind == "instance" && required(marker, "instance")? == key
        }
        FragmentMarkerKind::Slot { key } => {
            marker.kind == "slot"
                && fragment.slots.iter().any(|slot| {
                    &slot.key == key && marker.attributes.get("name") == Some(&slot.name)
                        && marker.attributes.get("instance").is_some_and(|receiver| fragment.markers.iter().any(|placement| {
                            &placement.id == receiver && matches!(&placement.kind, FragmentMarkerKind::Instance { key } if key == &slot.instance_key)
                        }))
                })
        }
        FragmentMarkerKind::Ignore { material_key } => {
            marker.kind == "ignore" && marker.attributes.get("key") == material_key.as_ref()
        }
        FragmentMarkerKind::Link { to } => marker.kind == "link" && required(marker, "to")? == to,
    };
    if valid {
        Ok(())
    } else {
        Err(invalid(
            Code::BuildInvalid,
            "forged fragment marker payload",
        ))
    }
}

pub(crate) fn slot<'a>(marker: &Marker, fragment: &'a Fragment) -> Result<&'a ComponentSlotRecord> {
    let key = fragment
        .markers
        .iter()
        .find_map(|record| {
            if record.id == marker.id {
                if let FragmentMarkerKind::Slot { key } = &record.kind {
                    Some(key)
                } else {
                    None
                }
            } else {
                None
            }
        })
        .ok_or_else(|| {
            invalid(
                Code::BuildInvalid,
                "slot marker has no authenticated placement",
            )
        })?;
    fragment
        .slots
        .iter()
        .find(|slot| &slot.key == key)
        .ok_or_else(|| {
            invalid(
                Code::BuildInvalid,
                "slot marker has no authenticated input record",
            )
        })
}
