//! Minimal parsed-document arena for pure CSS matching and retained containment proof.

use std::collections::BTreeMap;

use mokly_model::evidence::EvidenceOwner;

/// Physical containment by a composed component region.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Containment {
    /// Registered component parent path.
    pub path: String,
    /// True only for a component's own root region.
    pub root: bool,
}

/// One element after HTML5 tree building and ignored-region removal.
#[derive(Clone, Debug)]
pub struct MatchElement {
    /// Local name, preserving foreign namespace case.
    pub name: String,
    /// Namespace URI.
    pub namespace: String,
    /// Qualified attribute names and decoded values.
    pub attributes: BTreeMap<String, String>,
    /// Element parent, skipping region annotations.
    pub parent: Option<usize>,
    /// Element children in tree order.
    pub children: Vec<usize>,
    /// Whether any direct text node has nonzero length.
    pub text: bool,
    /// Inclusive physical component regions, from outermost to innermost.
    pub regions: Vec<Containment>,
    /// Inclusive input ancestry, with supplied slots attached to their supplier.
    pub input_regions: Vec<Containment>,
    /// Nearest input owner, including slot suppliers.
    pub owner: EvidenceOwner,
}

/// An inert document arena. Template contents do not enter it.
#[derive(Clone, Debug, Default)]
pub struct MatchTree {
    /// Elements in tree order.
    pub elements: Vec<MatchElement>,
}

impl MatchTree {
    /// Check element depth iteratively after validating arena references.
    pub(crate) fn exceeds_depth(&self, limit: usize) -> bool {
        let mut pending: Vec<_> = self
            .elements
            .iter()
            .enumerate()
            .filter(|(_, element)| element.parent.is_none())
            .map(|(index, _)| (index, 1usize))
            .collect();
        while let Some((index, depth)) = pending.pop() {
            if depth > limit {
                return true;
            }
            pending.extend(
                self.elements[index]
                    .children
                    .iter()
                    .map(|child| (*child, depth + 1)),
            );
        }
        false
    }

    /// Check arena references before matching. Invalid inputs produce unresolved evidence.
    pub fn valid(&self) -> bool {
        let mut incoming = vec![0usize; self.elements.len()];
        for (index, element) in self.elements.iter().enumerate() {
            if element
                .parent
                .is_some_and(|parent| parent >= self.elements.len())
            {
                return false;
            }
            for child in &element.children {
                let Some(node) = self.elements.get(*child) else {
                    return false;
                };
                if node.parent != Some(index) {
                    return false;
                }
                incoming[*child] += 1;
            }
        }
        if self
            .elements
            .iter()
            .enumerate()
            .any(|(index, element)| incoming[index] != usize::from(element.parent.is_some()))
        {
            return false;
        }
        let mut visited = vec![0u8; self.elements.len()];
        for index in 0..self.elements.len() {
            if visited[index] != 0 {
                continue;
            }
            let mut path = Vec::new();
            let mut next = Some(index);
            while let Some(index) = next {
                if visited[index] == 1 {
                    return false;
                }
                if visited[index] == 2 {
                    break;
                }
                visited[index] = 1;
                path.push(index);
                next = self.elements[index].parent;
            }
            for index in path {
                visited[index] = 2;
            }
        }
        true
    }
}
