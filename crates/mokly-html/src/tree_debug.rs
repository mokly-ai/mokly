//! Debug output visits deep trees iteratively, including on assertion failures.

use std::fmt;

use crate::tree::Node;

enum Item<'a> {
    Node(&'a Node),
    Text(&'static str),
}

impl fmt::Debug for Node {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut pending = vec![Item::Node(self)];
        while let Some(item) = pending.pop() {
            let node = match item {
                Item::Text(text) => {
                    formatter.write_str(text)?;
                    continue;
                }
                Item::Node(node) => node,
            };
            match node {
                Node::Text(text) => write!(formatter, "Text({text:?})")?,
                Node::Comment(text) => write!(formatter, "Comment({text:?})")?,
                Node::Doctype(name) => write!(formatter, "Doctype({name:?})")?,
                Node::Element(element) => {
                    write!(
                        formatter,
                        "Element(Element {{ style_owners: {:?}, origin: {:?}, navigation: {:?}, source: {:?}, name: {:?}, namespace: {:?}, attributes: {:?}, children: [",
                        element.style_owners,
                        element.origin,
                        element.navigation,
                        element.source,
                        element.name,
                        element.namespace,
                        element.attributes
                    )?;
                    pending.push(Item::Text("] })"));
                    children(&mut pending, &element.children);
                }
                Node::Region {
                    region,
                    children: nodes,
                } => {
                    write!(formatter, "Region {{ region: {region:?}, children: [")?;
                    pending.push(Item::Text("] }"));
                    children(&mut pending, nodes);
                }
            }
        }
        Ok(())
    }
}

fn children<'a>(pending: &mut Vec<Item<'a>>, nodes: &'a [Node]) {
    for (index, node) in nodes.iter().enumerate().rev() {
        pending.push(Item::Node(node));
        if index > 0 {
            pending.push(Item::Text(", "));
        }
    }
}
