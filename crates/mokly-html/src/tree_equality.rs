//! Structural equality includes annotations without recursive descendant comparisons.

use mokly_model::catalogue::SourceLocation;
use mokly_model::usage::ComponentInputOwner;

use crate::links::Reference;
use crate::tree::{Element, Node, RegionKind};

impl PartialEq for Node {
    fn eq(&self, other: &Self) -> bool {
        let mut pending = vec![(self, other)];
        while let Some((left, right)) = pending.pop() {
            let equal = match (left, right) {
                (Node::Text(a), Node::Text(b))
                | (Node::Comment(a), Node::Comment(b))
                | (Node::Doctype(a), Node::Doctype(b)) => a == b,
                (Node::Element(a), Node::Element(b)) => element(a, b),
                (Node::Region { region: a, .. }, Node::Region { region: b, .. }) => {
                    a.id == b.id && region(&a.kind, &b.kind)
                }
                _ => false,
            };
            if !equal || left.children().len() != right.children().len() {
                return false;
            }
            pending.extend(left.children().iter().zip(right.children()));
        }
        true
    }
}

impl Eq for Node {}

fn element(left: &Element, right: &Element) -> bool {
    left.name == right.name
        && left.style_owners == right.style_owners
        && left.style_attribution == right.style_attribution
        && left.namespace == right.namespace
        && left.attributes == right.attributes
        && left.origin == right.origin
        && location(left.source.as_ref()) == location(right.source.as_ref())
        && link(left.navigation.as_ref()) == link(right.navigation.as_ref())
}

fn location(value: Option<&SourceLocation>) -> Option<(&str, usize, usize, Option<&str>)> {
    value.map(|source| {
        (
            source.path.as_str(),
            source.line,
            source.column,
            source.export.as_deref(),
        )
    })
}

fn link(value: Option<&Reference>) -> Option<(&str, &str, Option<&str>)> {
    value.map(|reference| {
        (
            reference.source_route.as_str(),
            reference.target.as_str(),
            reference.fragment.as_deref(),
        )
    })
}

fn owner(value: &ComponentInputOwner) -> Option<&str> {
    match value {
        ComponentInputOwner::Entry => None,
        ComponentInputOwner::Instance { instance_key } => Some(instance_key),
    }
}

fn region(left: &RegionKind, right: &RegionKind) -> bool {
    match (left, right) {
        (RegionKind::Root { path: a }, RegionKind::Root { path: b }) => a == b,
        (
            RegionKind::Ignore {
                id: a,
                material_key: ak,
            },
            RegionKind::Ignore {
                id: b,
                material_key: bk,
            },
        ) => a == b && ak == bk,
        (
            RegionKind::Instance {
                path: a,
                key: ak,
                local_id: ai,
                props_key: ap,
            },
            RegionKind::Instance {
                path: b,
                key: bk,
                local_id: bi,
                props_key: bp,
            },
        ) => (a, ak, ai, ap) == (b, bk, bi, bp),
        (
            RegionKind::Slot {
                key: a,
                instance_key: ai,
                name: an,
                owner: ao,
            },
            RegionKind::Slot {
                key: b,
                instance_key: bi,
                name: bn,
                owner: bo,
            },
        ) => (a, ai, an, owner(ao)) == (b, bi, bn, owner(bo)),
        _ => false,
    }
}
