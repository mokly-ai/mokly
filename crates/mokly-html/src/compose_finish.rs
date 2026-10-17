//! Complete pending wrappers after their children finish composing.

use std::sync::Arc;

use crate::compose_machine::Output;
use crate::composition::Engine;
use crate::context::Context;
use crate::control_roots;
use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::expansion::{After, Expansion};
use crate::tree::{Node, Region, RegionKind};

pub(crate) enum Completed {
    Output(Output),
    Expand(Expansion),
}

pub(crate) fn finish(
    engine: &mut Engine<'_>,
    mut output: Output,
    after: Vec<After>,
    context: Arc<Context>,
) -> Result<Completed> {
    let mut after = after.into_iter();
    while let Some(action) = after.next() {
        match action {
            After::Node(mut node) => {
                output.ownership |= matches!(&node, Node::Region { region, .. }
                    if matches!(region.kind, RegionKind::Instance { .. } | RegionKind::Slot { .. }));
                if let Some(children) = node.children_mut() {
                    *children = output.nodes;
                }
                output.nodes = vec![node];
            }
            After::Ignore { id, material_key } => {
                if output.ownership {
                    return Err(invalid(
                        Code::HtmlElement,
                        format!("ignore region {id} cannot enclose an instance or slot region"),
                    ));
                }
                output.nodes = vec![Node::Region {
                    region: Region {
                        id: String::new(),
                        kind: RegionKind::Ignore { id, material_key },
                    },
                    children: output.nodes,
                }];
            }
            After::Component {
                region,
                target,
                fragment,
                source,
            } => {
                engine.stack.pop();
                if let Some(target) = target {
                    control_roots::mark(&mut output.nodes, &target, fragment.as_deref())?;
                    control_roots::source(&mut output.nodes, source);
                }
                output.nodes = vec![Node::Region {
                    region,
                    children: output.nodes,
                }];
                output.ownership = true;
            }
            After::Slot { cache, region } => {
                if let Some(cache) = cache {
                    engine.slot_cache.insert(cache, output.nodes.clone());
                }
                if let Some(region) = region {
                    output.nodes = vec![Node::Region {
                        region,
                        children: output.nodes,
                    }];
                    output.ownership = true;
                }
            }
            After::JavaScript {
                placeholders,
                component,
                page,
            } => {
                let placeholders = placeholders.borrow();
                if placeholders
                    .tokens
                    .keys()
                    .any(|name| !placeholders.seen.contains(name))
                {
                    return Err(invalid(
                        Code::HtmlSlot,
                        "a supplied JavaScript slot placeholder was not rendered",
                    ));
                }
                if let Some(component) = component
                    && !engine.components.contains(&component)
                {
                    engine.components.push(component);
                }
                if page {
                    let mut expansion = Expansion::native(output.nodes, context);
                    expansion.after = after.collect();
                    return Ok(Completed::Expand(expansion));
                }
            }
        }
    }
    Ok(Completed::Output(output))
}
