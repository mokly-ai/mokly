//! Resource edges collected from parsed HTML and tokenized CSS.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::syntax;
use mokly_html::parse;
use mokly_html::tree::{Element, Node, RegionKind};
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

fn walk(
    nodes: &[Node],
    owner: &EvidenceOwner,
    ignored: bool,
    instances: &BTreeMap<String, String>,
    output: &mut Vec<ResourceReference>,
) {
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                let nested = match &region.kind {
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
                    _ => owner.clone(),
                };
                walk(
                    children,
                    &nested,
                    ignored || matches!(region.kind, RegionKind::Ignore { .. }),
                    instances,
                    output,
                );
            }
            Node::Element(element) => {
                let rel: Vec<_> = element
                    .get("rel")
                    .unwrap_or("")
                    .split_ascii_whitespace()
                    .collect();
                let speculative = element.name == "link"
                    && rel.iter().any(|value| {
                        value.eq_ignore_ascii_case("preload")
                            || value.eq_ignore_ascii_case("prefetch")
                    })
                    && !rel
                        .iter()
                        .any(|value| value.eq_ignore_ascii_case("stylesheet"));
                let ignored = ignored || speculative;
                for attribute in &element.attributes {
                    if element.name == "base" && attribute.name == "href" {
                        continue;
                    }
                    if matches!(
                        attribute.name.as_str(),
                        "src" | "href" | "xlink:href" | "data-nav-href" | "poster" | "data"
                    ) {
                        output.push(ResourceReference {
                            url: attribute.value.clone(),
                            owner: owner.clone(),
                            ignored,
                        });
                    } else if attribute.name == "srcset" {
                        for url in srcset(&attribute.value) {
                            output.push(ResourceReference {
                                url,
                                owner: owner.clone(),
                                ignored,
                            });
                        }
                    } else if attribute.name == "style" {
                        for reference in syntax::references(&format!("x{{{}}}", attribute.value)) {
                            output.push(ResourceReference {
                                url: reference.value,
                                owner: owner.clone(),
                                ignored,
                            });
                        }
                    } else if attribute.name == "srcdoc" {
                        walk(
                            &parse::document(&attribute.value),
                            owner,
                            ignored,
                            instances,
                            output,
                        );
                    }
                }
                if element.name == "style" {
                    for node in &element.children {
                        if let Node::Text(css) = node {
                            for reference in syntax::references(css) {
                                output.push(ResourceReference {
                                    url: reference.value,
                                    owner: owner.clone(),
                                    ignored,
                                });
                            }
                        }
                    }
                }
                walk(&element.children, owner, ignored, instances, output);
            }
            _ => {}
        }
    }
}

fn instance_paths(nodes: &[Node], paths: &mut BTreeMap<String, String>) {
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                if let RegionKind::Instance { key, path, .. } = &region.kind {
                    paths.insert(key.clone(), path.clone());
                }
                instance_paths(children, paths);
            }
            Node::Element(element) => instance_paths(&element.children, paths),
            _ => {}
        }
    }
}

/// Index every decoded HTML id for final fragment validation.
pub fn anchors(nodes: &[Node]) -> BTreeSet<String> {
    let mut output = BTreeSet::new();
    visit(nodes, &mut |element| {
        if let Some(id) = element.get("id") {
            output.insert(id.into());
        }
    });
    output
}

fn visit(nodes: &[Node], callback: &mut dyn FnMut(&Element)) {
    for node in nodes {
        match node {
            Node::Element(element) => {
                callback(element);
                visit(&element.children, callback);
            }
            Node::Region { children, .. } => visit(children, callback),
            _ => {}
        }
    }
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
