//! Root regions cover adapter output while consumer renderer wrappers stay entry-owned.

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::{Node, Region, RegionKind};

pub(crate) fn attach(nodes: Vec<Node>, path: &str) -> Result<Vec<Node>> {
    let mut roots = 0;
    let mut prior_owner = false;
    check(&nodes, false, &mut roots, &mut prior_owner)?;
    if roots == 0 {
        Ok(vec![Node::Region {
            region: Region {
                id: String::new(),
                kind: RegionKind::Root { path: path.into() },
            },
            children: nodes,
        }])
    } else if roots == 1 {
        Ok(nodes)
    } else {
        Err(invalid(
            Code::BuildInvalid,
            "component output must have one root range",
        ))
    }
}

fn check(
    nodes: &[Node],
    inside_owner: bool,
    roots: &mut usize,
    prior_owner: &mut bool,
) -> Result<()> {
    for node in nodes {
        match node {
            Node::Element(element) => check(&element.children, inside_owner, roots, prior_owner)?,
            Node::Region { region, children } => {
                let ownership = matches!(
                    region.kind,
                    RegionKind::Instance { .. } | RegionKind::Slot { .. }
                );
                if matches!(region.kind, RegionKind::Root { .. }) {
                    if inside_owner || *prior_owner && *roots == 0 {
                        return Err(invalid(
                            Code::BuildInvalid,
                            "component output must form root range r-0 outside instance and slot ranges",
                        ));
                    }
                    *roots += 1;
                }
                *prior_owner |= ownership;
                check(children, inside_owner || ownership, roots, prior_owner)?;
            }
            _ => {}
        }
    }
    Ok(())
}
