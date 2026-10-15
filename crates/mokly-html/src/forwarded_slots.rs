//! A direct placeholder forwards the original supplied value and input owner.

use crate::context::{Context, Slot};
use crate::tree::Node;

pub(crate) fn forwarded(nodes: &[Node], context: &Context) -> Option<Slot> {
    let mut meaningful = nodes.iter().filter(|node| {
        !matches!(node, Node::Comment(_))
            && !matches!(node, Node::Text(text) if text.bytes().all(|byte| byte.is_ascii_whitespace()))
    });
    let Some(Node::Element(element)) = meaningful.next() else {
        return None;
    };
    if meaningful.next().is_some()
        || element.name != "slot"
        || element
            .attributes
            .iter()
            .any(|attribute| attribute.name != "name")
    {
        return None;
    }
    let name = element.get("name").unwrap_or("children");
    context.slots.get(name).cloned()
}
