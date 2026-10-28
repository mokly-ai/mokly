//! Source locations for authored HTML and saved slot fragments.

use mokly_catalogue::template_types::{SavedSlot, Template};

use crate::error::Result;
use crate::tree::Node;
use crate::{parse, source_checks};

/// Parse one authored template with source positions attached by the token pipeline.
pub(crate) fn template(template: &Template) -> Result<Vec<Node>> {
    source_checks::validate(template.html(), false)?;
    Ok(parse::html(template.located_html()))
}

pub(crate) fn slot(slot: &SavedSlot, entry: &str, name: &str) -> Vec<Node> {
    let mut nodes = parse::html(slot.html());
    let mut next = 0;
    slot_origins(&mut nodes, &format!("saved-slot:{entry}:{name}"), &mut next);
    nodes
}

fn slot_origins(nodes: &mut [Node], prefix: &str, next: &mut usize) {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            element.origin = Some(format!("{prefix}:{}", *next));
            *next += 1;
            pending.extend(element.children.iter_mut().rev());
        }
    }
}
