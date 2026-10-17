//! Navigation tree ownership operations do not recurse through catalogue depth.

use std::{fmt, mem};

use crate::public_index::CatalogueNode;

impl CatalogueNode {
    fn children(&self) -> &[Self] {
        match self {
            Self::Folder { children, .. } => children,
            Self::Entry { children, .. } => children.as_deref().unwrap_or_default(),
        }
    }
    fn children_mut(&mut self) -> Option<&mut Vec<Self>> {
        match self {
            Self::Folder { children, .. } => Some(children),
            Self::Entry { children, .. } => children.as_mut(),
        }
    }
}

impl Clone for CatalogueNode {
    fn clone(&self) -> Self {
        let mut output = shallow(self);
        let mut pending = vec![(self, &mut output)];
        while let Some((source, target)) = pending.pop() {
            if let Some(children) = target.children_mut() {
                *children = source.children().iter().map(shallow).collect();
                pending.extend(source.children().iter().zip(children));
            }
        }
        output
    }
}

impl Drop for CatalogueNode {
    fn drop(&mut self) {
        let mut pending = self.children_mut().map(mem::take).unwrap_or_default();
        while let Some(mut node) = pending.pop() {
            if let Some(children) = node.children_mut() {
                pending.append(children);
            }
        }
    }
}

fn shallow(node: &CatalogueNode) -> CatalogueNode {
    match node {
        CatalogueNode::Folder {
            path,
            title,
            index,
            hidden,
            order,
            ..
        } => CatalogueNode::Folder {
            path: path.clone(),
            title: title.clone(),
            index: index.clone(),
            hidden: hidden.clone(),
            order: order.clone(),
            children: vec![],
        },
        CatalogueNode::Entry {
            path,
            hidden,
            order,
            children,
        } => CatalogueNode::Entry {
            path: path.clone(),
            hidden: hidden.clone(),
            order: order.clone(),
            children: children.as_ref().map(|_| vec![]),
        },
    }
}

impl fmt::Debug for CatalogueNode {
    fn fmt(&self, output: &mut fmt::Formatter<'_>) -> fmt::Result {
        enum Step<'a> {
            Node(&'a CatalogueNode),
            Text(&'static str),
        }
        let mut pending = vec![Step::Node(self)];
        while let Some(step) = pending.pop() {
            let node = match step {
                Step::Text(text) => {
                    output.write_str(text)?;
                    continue;
                }
                Step::Node(node) => node,
            };
            let (children, ending) = match node {
                CatalogueNode::Folder {
                    path,
                    title,
                    index,
                    hidden,
                    order,
                    children,
                } => {
                    write!(
                        output,
                        "Folder {{ path: {path:?}, title: {title:?}, index: {index:?}, hidden: {hidden:?}, order: {order:?}, children: ["
                    )?;
                    (children.as_slice(), "] }")
                }
                CatalogueNode::Entry {
                    path,
                    hidden,
                    order,
                    children,
                } => {
                    write!(
                        output,
                        "Entry {{ path: {path:?}, hidden: {hidden:?}, order: {order:?}, children: "
                    )?;
                    if let Some(children) = children {
                        output.write_str("Some([")?;
                        (children.as_slice(), "]) }")
                    } else {
                        output.write_str("None }")?;
                        continue;
                    }
                }
            };
            pending.push(Step::Text(ending));
            for (index, child) in children.iter().enumerate().rev() {
                pending.push(Step::Node(child));
                if index > 0 {
                    pending.push(Step::Text(", "));
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/catalogue_tree_tests.rs"]
mod catalogue_tree_tests;
