//! Canonical value equality, destruction, and move hashing use explicit stacks.

use std::mem;

use mokly_model::canonical;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::comparison_error::CompareResult;
use crate::error::Result;
use crate::instance_inputs::SlotSignal;
use crate::material::Material;

/// Child counts make the preorder token stream unambiguous without nested serialization.
#[derive(PartialEq, Serialize)]
enum Header<'a> {
    Element(&'a str, &'a str, &'a [(String, String)], usize),
    Text(&'a str),
    Comment(&'a str),
    Doctype(&'a str),
    Instance(&'a str, &'a str, &'a str, &'a str, &'a [SlotSignal]),
    SlotBoundary(&'a str),
    Ignore(&'a str, &'a Option<String>),
    Slot(&'a str, usize),
}

impl Material {
    fn header(&self) -> Header<'_> {
        match self {
            Self::Element(ns, name, attributes, children) => {
                Header::Element(ns, name, attributes, children.len())
            }
            Self::Text(text) => Header::Text(text),
            Self::Comment(text) => Header::Comment(text),
            Self::Doctype(text) => Header::Doctype(text),
            Self::Instance(key, path, id, props, inputs) => {
                Header::Instance(key, path, id, props, inputs)
            }
            Self::SlotBoundary(name) => Header::SlotBoundary(name),
            Self::Ignore(id, key) => Header::Ignore(id, key),
            Self::Slot(key, children) => Header::Slot(key, children.len()),
        }
    }

    fn children(&self) -> &[Self] {
        match self {
            Self::Element(_, _, _, children) | Self::Slot(_, children) => children,
            _ => &[],
        }
    }

    fn take_children(&mut self) -> Vec<Self> {
        match self {
            Self::Element(_, _, _, children) | Self::Slot(_, children) => mem::take(children),
            _ => Vec::new(),
        }
    }
}

impl PartialEq for Material {
    fn eq(&self, other: &Self) -> bool {
        let mut pending = vec![(self, other)];
        while let Some((left, right)) = pending.pop() {
            if left.header() != right.header() {
                return false;
            }
            pending.extend(left.children().iter().zip(right.children()).rev());
        }
        true
    }
}

impl Drop for Material {
    fn drop(&mut self) {
        let mut pending = self.take_children();
        while let Some(mut node) = pending.pop() {
            pending.extend(node.take_children());
        }
    }
}

/// Private move prefilter; the paired comparison still proves equality.
pub(crate) fn fingerprint(nodes: &[Material]) -> Result<String> {
    let mut hash = Sha256::new();
    hash.update((nodes.len() as u64).to_le_bytes());
    let mut pending: Vec<_> = nodes.iter().rev().collect();
    while let Some(node) = pending.pop() {
        hash.update(canonical::to_string(&node.header()).compare()?.as_bytes());
        pending.extend(node.children().iter().rev());
    }
    Ok(hash
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}
