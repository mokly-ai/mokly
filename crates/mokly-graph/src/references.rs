//! Resource edges collected from parsed HTML and tokenized CSS.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::syntax;
use mokly_html::parse;
use mokly_html::tree::{self, Element, Node, RegionKind};
use mokly_model::evidence::EvidenceOwner;
use mokly_model::usage::ComponentInputOwner;

/// One resource reference and its material owner.
#[derive(Clone, Debug)]
pub struct ResourceReference {
    /// Authored URL or portable rendered reference.
    pub url: String,
    /// Nearest component or supplying entry owner.
    pub owner: EvidenceOwner,
    /// Ignored references require delivery but supply no change evidence.
    pub ignored: bool,
}

/// Collect URL-bearing attributes, style URLs, and embedded documents.
pub fn collect(nodes: &[Node]) -> Vec<ResourceReference> {
    let mut output = Vec::new();
    let mut instances = BTreeMap::new();
    instance_paths(nodes, &mut instances);
    walk(nodes, &EvidenceOwner::Entry, false, &instances, &mut output);
    output
}

enum NodeRef<'a> {
    Borrowed(&'a Node),
    Owned(Box<Node>),
}
impl NodeRef<'_> {
    fn as_ref(&self) -> &Node {
        match self {
            Self::Borrowed(node) => node,
            Self::Owned(node) => node,
        }
    }
}

enum Step<'a> {
    Node(NodeRef<'a>, EvidenceOwner, bool),
    Reference(ResourceReference),
}

fn walk(
    nodes: &[Node],
    owner: &EvidenceOwner,
    ignored: bool,
    instances: &BTreeMap<String, String>,
    output: &mut Vec<ResourceReference>,
) {
    let mut pending: Vec<_> = nodes
        .iter()
        .rev()
        .map(|node| Step::Node(NodeRef::Borrowed(node), owner.clone(), ignored))
        .collect();
    while let Some(step) = pending.pop() {
        let (node, mut owner, mut ignored) = match step {
            Step::Reference(reference) => {
                output.push(reference);
                continue;
            }
            Step::Node(node, owner, ignored) => (node, owner, ignored),
        };
        let mut next = Vec::new();
        match node.as_ref() {
            Node::Region { region, .. } => {
                owner = match &region.kind {
                    RegionKind::Instance { path, .. } | RegionKind::Root { path } => {
                        EvidenceOwner::Component { path: path.clone() }
                    }
                    RegionKind::Slot {
                        owner: ComponentInputOwner::Instance { instance_key },
                        ..
                    } => instances
                        .get(instance_key)
                        .map_or(EvidenceOwner::Entry, |path| EvidenceOwner::Component {
                            path: path.clone(),
                        }),
                    RegionKind::Slot { .. } => EvidenceOwner::Entry,
                    _ => owner,
                };
                ignored |= matches!(region.kind, RegionKind::Ignore { .. });
            }
            Node::Element(element) => {
                element_references(element, &owner, ignored, &mut next);
            }
            _ => {}
        }
        next.extend(
            children(node)
                .into_iter()
                .map(|node| Step::Node(node, owner.clone(), ignored)),
        );
        pending.extend(next.into_iter().rev());
    }
}

fn children(node: NodeRef<'_>) -> Vec<NodeRef<'_>> {
    match node {
        NodeRef::Borrowed(node) => node.children().iter().map(NodeRef::Borrowed).collect(),
        NodeRef::Owned(mut node) => node
            .take_children()
            .into_iter()
            .map(|node| NodeRef::Owned(Box::new(node)))
            .collect(),
    }
}

fn element_references(
    element: &Element,
    owner: &EvidenceOwner,
    ignored: bool,
    output: &mut Vec<Step<'_>>,
) {
    let reference = |url| {
        Step::Reference(ResourceReference {
            url,
            owner: owner.clone(),
            ignored,
        })
    };
    for attribute in &element.attributes {
        if element.name == "base" && attribute.name == "href" {
            continue;
        }
        match attribute.name.as_str() {
            "src" | "href" | "xlink:href" | "data-nav-href" | "poster" | "data" => {
                output.push(reference(attribute.value.clone()));
            }
            "srcset" => output.extend(srcset(&attribute.value).into_iter().map(reference)),
            "style" => output.extend(
                syntax::references(&format!("x{{{}}}", attribute.value))
                    .into_iter()
                    .map(|value| reference(value.value)),
            ),
            "srcdoc" => output.extend(
                parse::document(&attribute.value)
                    .into_iter()
                    .map(|node| Step::Node(NodeRef::Owned(Box::new(node)), owner.clone(), ignored)),
            ),
            _ => {}
        }
    }
    if element.name == "style" {
        for child in &element.children {
            if let Node::Text(css) = child {
                output.extend(
                    syntax::references(css)
                        .into_iter()
                        .map(|value| reference(value.value)),
                );
            }
        }
    }
}

fn instance_paths(nodes: &[Node], paths: &mut BTreeMap<String, String>) {
    for node in tree::walk(nodes) {
        if let Node::Region { region, .. } = node
            && let RegionKind::Instance { key, path, .. } = &region.kind
        {
            paths.insert(key.clone(), path.clone());
        }
    }
}

/// Index every decoded HTML id for final fragment validation.
pub fn anchors(nodes: &[Node]) -> BTreeSet<String> {
    tree::walk(nodes)
        .filter_map(|node| match node {
            Node::Element(element) => element.get("id").map(str::to_owned),
            _ => None,
        })
        .collect()
}

fn srcset(value: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut rest = value;
    while !rest.trim_start().is_empty() {
        rest = rest.trim_start_matches(|c: char| c.is_ascii_whitespace() || c == ',');
        let end = rest.find(char::is_whitespace).unwrap_or(rest.len());
        let url = &rest[..end];
        if !url.is_empty() {
            urls.push(url.trim_end_matches(',').into());
        }
        rest = &rest[end..];
        if url.ends_with(',') {
            continue;
        }
        if let Some(comma) = rest.find(',') {
            rest = &rest[comma + 1..];
        } else {
            break;
        }
    }
    urls
}
