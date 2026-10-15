//! A direct placeholder forwards the original supplied value and input owner.

use crate::context::{Context, Slot};
use crate::tree::Node;

pub(crate) fn forwarded(nodes: &[Node], context: &Context) -> Option<Slot> {
    let [Node::Element(element)] = nodes else {
        return None;
    };
    if element.name != "slot"
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
