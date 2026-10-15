//! Parser-owned arena supports HTML5 moves without reference cycles or recursive conversion.

use std::cell::RefCell;

use html5ever::{QualName, local_name, ns};

use crate::tree::{Element, Node};

#[derive(Clone)]
pub(crate) struct Handle {
    pub(crate) index: usize,
    pub(crate) name: QualName,
}

pub(crate) struct Entry {
    pub(crate) node: Option<Node>,
    pub(crate) parent: Option<Handle>,
    pub(crate) children: Vec<Handle>,
    pub(crate) template: Option<Handle>,
    pub(crate) integration: bool,
}

pub(crate) struct Arena {
    pub(crate) entries: RefCell<Vec<Entry>>,
}

impl Default for Arena {
    fn default() -> Self {
        Self {
            entries: RefCell::new(vec![Entry::new(None)]),
        }
    }
}

impl Entry {
    fn new(node: Option<Node>) -> Self {
        Self {
            node,
            parent: None,
            children: Vec::new(),
            template: None,
            integration: false,
        }
    }
}

impl Handle {
    pub(crate) fn anonymous(index: usize) -> Self {
        Self {
            index,
            name: QualName::new(None, ns!(html), local_name!("")),
        }
    }
}

impl Arena {
    pub(crate) fn create(&self, node: Option<Node>, name: Option<QualName>) -> Handle {
        let mut entries = self.entries.borrow_mut();
        let handle = Handle {
            index: entries.len(),
            name: name.unwrap_or_else(|| Handle::anonymous(0).name),
        };
        entries.push(Entry::new(node));
        handle
    }

    pub(crate) fn detach(entries: &mut [Entry], target: &Handle) {
        if let Some(parent) = entries[target.index].parent.take() {
            entries[parent.index]
                .children
                .retain(|child| child.index != target.index);
        }
    }

    pub(crate) fn insert(&self, parent: &Handle, before: Option<&Handle>, child: Handle) {
        let mut entries = self.entries.borrow_mut();
        Self::detach(&mut entries, &child);
        let index = before
            .and_then(|before| {
                entries[parent.index]
                    .children
                    .iter()
                    .position(|item| item.index == before.index)
            })
            .unwrap_or(entries[parent.index].children.len());
        if index > 0 {
            let previous = entries[parent.index].children[index - 1].index;
            if matches!(entries[previous].node, Some(Node::Text(_)))
                && matches!(entries[child.index].node, Some(Node::Text(_)))
                && let Some(Node::Text(text)) = entries[child.index].node.take()
                && let Some(Node::Text(previous)) = &mut entries[previous].node
            {
                previous.push_str(&text);
                return;
            }
        }
        entries[child.index].parent = Some(parent.clone());
        entries[parent.index].children.insert(index, child);
    }

    pub(crate) fn output(self) -> Vec<Node> {
        let mut entries = self.entries.into_inner();
        let mut built: Vec<Option<Node>> = (0..entries.len()).map(|_| None).collect();
        let mut pending = vec![(0, false)];
        while let Some((index, visited)) = pending.pop() {
            let child_index = entries[index]
                .template
                .as_ref()
                .map_or(index, |template| template.index);
            if !visited {
                pending.push((index, true));
                pending.extend(
                    entries[child_index]
                        .children
                        .iter()
                        .rev()
                        .map(|child| (child.index, false)),
                );
                continue;
            }
            let children: Vec<_> = entries[child_index]
                .children
                .iter()
                .filter_map(|child| built[child.index].take())
                .collect();
            if index == 0 {
                return children;
            }
            let mut node = entries[index].node.take();
            if let Some(Node::Element(Element {
                children: target, ..
            })) = &mut node
            {
                *target = children;
            }
            built[index] = node;
        }
        Vec::new()
    }
}
