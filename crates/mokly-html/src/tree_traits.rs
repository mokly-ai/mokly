//! Owned trees clone and release descendants without using the call stack.

use crate::tree::{Element, Node};

impl Clone for Node {
    fn clone(&self) -> Self {
        let mut result = shallow(self);
        let mut pending = vec![(self, &mut result)];
        while let Some((source, target)) = pending.pop() {
            if let Some(children) = target.children_mut() {
                *children = source.children().iter().map(shallow).collect();
                pending.extend(source.children().iter().zip(children));
            }
        }
        result
    }
}

impl Drop for Node {
    fn drop(&mut self) {
        let mut pending = self.take_children();
        while let Some(mut node) = pending.pop() {
            if let Some(children) = node.children_mut() {
                pending.append(children);
            }
        }
    }
}

fn shallow(node: &Node) -> Node {
    match node {
        Node::Text(text) => Node::Text(text.clone()),
        Node::Comment(text) => Node::Comment(text.clone()),
        Node::Doctype(name) => Node::Doctype(name.clone()),
        Node::Element(element) => Node::Element(Element {
            origin: element.origin.clone(),
            navigation: element.navigation.clone(),
            source: element.source.clone(),
            name: element.name.clone(),
            namespace: element.namespace.clone(),
            attributes: element.attributes.clone(),
            children: Vec::new(),
        }),
        Node::Region { region, .. } => Node::Region {
            region: region.clone(),
            children: Vec::new(),
        },
    }
}
