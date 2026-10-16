//! Close one authenticated sibling marker without recursive tree processing.

use std::collections::BTreeSet;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::Fragment;
use crate::marker_syntax::{Marker, required};
use crate::tree::{Node, Region, RegionKind};
use crate::{control_roots, marker_auth};

pub(crate) fn close(
    start: Marker,
    mut children: Vec<Node>,
    fragment: &Fragment,
    ignore_ids: &mut BTreeSet<String>,
    output_root: Option<&str>,
) -> Result<Vec<Node>> {
    let kind = match start.kind.as_str() {
        "output" => output_root.map(|path| RegionKind::Root { path: path.into() }),
        "instance" => {
            let key = required(&start, "instance")?;
            let instance = fragment
                .instances
                .iter()
                .find(|instance| instance.key == key)
                .ok_or_else(|| {
                    invalid(
                        Code::BuildInvalid,
                        "instance marker has no authenticated input record",
                    )
                })?;
            if required(&start, "path")? != instance.component_id
                || required(&start, "props")? != instance.props_key
            {
                return Err(invalid(Code::BuildInvalid, "forged instance marker"));
            }
            Some(RegionKind::Instance {
                path: instance.component_id.clone(),
                key: key.into(),
                local_id: instance.id.clone(),
                props_key: instance.props_key.clone(),
            })
        }
        "slot" => {
            let slot = marker_auth::slot(&start, fragment)?;
            Some(RegionKind::Slot {
                key: slot.key.clone(),
                instance_key: slot.instance_key.clone(),
                name: slot.name.clone(),
                owner: slot.owner.clone(),
            })
        }
        "ignore" => {
            if !ignore_ids.insert(start.id.clone()) {
                return Err(invalid(Code::BuildInvalid, "duplicate ignore id"));
            }
            Some(RegionKind::Ignore {
                id: start.id.clone(),
                material_key: start.attributes.get("key").cloned(),
            })
        }
        "link" => {
            let target = required(&start, "to")?;
            let target = target.strip_prefix("mock:").unwrap_or(target);
            let (target, fragment) = target
                .split_once('#')
                .map_or((target, None), |(target, fragment)| {
                    (target, Some(fragment))
                });
            control_roots::mark(&mut children, target, fragment)?;
            None
        }
        _ => return Err(invalid(Code::BuildInvalid, "unknown fragment marker")),
    };
    Ok(if let Some(kind) = kind {
        vec![Node::Region {
            region: Region {
                id: start.id.clone(),
                kind,
            },
            children,
        }]
    } else {
        children
    })
}
