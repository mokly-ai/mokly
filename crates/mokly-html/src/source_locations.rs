//! Source locations for authored HTML and saved slot fragments.

use mokly_catalogue::template_types::Template;

use crate::error::Result;
use crate::tree::Node;
use crate::{parse, source_checks};

/// Parse one authored template with source positions attached by the token pipeline.
pub(crate) fn template(template: &Template) -> Result<Vec<Node>> {
    source_checks::validate(&template.body, false)?;
    let (line, column) = body_location(template);
    let nodes = if template.page {
        parse::authored_document_at(&template.body, &template.source_path, line, column)
    } else {
        parse::authored_fragment_at(&template.body, &template.source_path, line, column)
    };
    Ok(nodes)
}

fn body_location(template: &Template) -> (usize, usize) {
    let end = template.body_offset.min(template.source.len());
    let mut line = 1;
    let mut column = 1;
    for character in template.source.get(..end).unwrap_or_default().chars() {
        if character == '\n' {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }
    (line, column)
}

pub(crate) fn slot(body: &str, entry: &str, name: &str) -> Vec<Node> {
    let mut nodes = parse::authored_fragment_unlocated(body);
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
