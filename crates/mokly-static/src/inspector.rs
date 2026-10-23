//! Head-only inspector publication from authenticated composition metadata.

use std::collections::BTreeMap;

use mokly_html::composition::Composed;
use mokly_html::serialize;
use mokly_html::tree::{self, Node};
use mokly_model::usage::{CatalogueUsage, ComponentRangeTarget};
use serde::Serialize;

use crate::error::{Error, InternalError, Result};
use crate::inspector_error::InspectorFailure;

#[derive(Serialize)]
struct Metadata {
    ranges: Vec<(Option<String>, Option<usize>)>,
    links: Vec<Navigation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<&'static str>,
}
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
struct Navigation {
    screen_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    fragment: Option<String>,
    target: Target,
}

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Target {
    #[serde(rename = "self")]
    Self_,
    Top,
    Parent,
    Blank,
    Named {
        name: String,
    },
}

/// Add bounded inert metadata and the packaged script without changing body positions.
pub fn inject(document: &Composed, route: &str) -> Result<Vec<u8>> {
    let mut nodes = document.tree.clone();
    let mut metadata = Metadata {
        ranges: Vec::new(),
        links: Vec::new(),
        error: None,
    };
    match &document.usage {
        CatalogueUsage::Ready {
            instances, ranges, ..
        } => {
            if instances.len() > 1024 || ranges.len() > 4096 {
                metadata.error = Some("limit");
            } else {
                for (index, range) in ranges.iter().enumerate() {
                    let parent = range
                        .parent_id
                        .as_ref()
                        .and_then(|id| id.strip_prefix("r-"))
                        .and_then(|value| value.parse::<usize>().ok());
                    if range.id != format!("r-{index}")
                        || parent.is_some_and(|parent| parent >= index)
                        || (range.parent_id.is_some() && parent.is_none())
                    {
                        return Err(Error::Inspector {
                            route: route.into(),
                            reason: InspectorFailure::Ranges,
                        });
                    }
                    let key = match &range.target {
                        ComponentRangeTarget::Instance { instance_key } => {
                            Some(instance_key.clone())
                        }
                        _ => None,
                    };
                    metadata.ranges.push((key, parent));
                }
            }
        }
        _ => metadata.error = Some("unavailable"),
    }
    links(&mut nodes, &mut metadata.links, &mut BTreeMap::new(), route)?;
    if metadata.links.len() > 1024 {
        metadata.error = Some("limit");
    }
    let mut text = encode(&metadata)?;
    if text.len() > 262_144 {
        metadata.error = Some("limit");
    }
    if metadata.error.is_some() {
        metadata.ranges.clear();
        metadata.links.clear();
        clear_links(&mut nodes);
        text = encode(&metadata)?;
    }
    let additions = vec![
        tree::element(
            "template",
            &[("data-mokly-inspector", "")],
            vec![Node::Text(text)],
        ),
        tree::element(
            "script",
            &[("src", "/mokly-viewer/client/inspector.js")],
            Vec::new(),
        ),
    ];
    if !head(&mut nodes, &additions) {
        return Err(Error::Inspector {
            route: route.into(),
            reason: InspectorFailure::Head,
        });
    }
    Ok(serialize::html(&nodes).into_bytes())
}

fn encode(metadata: &Metadata) -> Result<String> {
    match serde_json::to_string(metadata) {
        Ok(text) => Ok(text),
        Err(source) => Err(InternalError::Json { source }.into()),
    }
}

fn links(
    nodes: &mut [Node],
    output: &mut Vec<Navigation>,
    indices: &mut BTreeMap<Navigation, usize>,
    route: &str,
) -> Result<()> {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Element(element) => {
                for attribute in ["data-mokly-inspector", "data-mokly-inspector-link"] {
                    if element.get(attribute).is_some() {
                        return Err(Error::Inspector {
                            route: route.into(),
                            reason: InspectorFailure::Reserved { attribute },
                        });
                    }
                }
                if let Some(reference) = &element.navigation
                    && element.get("data-mokly-link").is_some()
                {
                    let navigation = Navigation {
                        screen_path: reference.target.clone(),
                        fragment: reference.fragment.clone(),
                        target: match element.get("data-mokly-target").unwrap_or("_self") {
                            "_self" => Target::Self_,
                            "_top" => Target::Top,
                            "_parent" => Target::Parent,
                            "_blank" => Target::Blank,
                            name => Target::Named { name: name.into() },
                        },
                    };
                    if !wire_link(&navigation) {
                        pending.extend(element.children.iter_mut().rev());
                        continue;
                    }
                    let index = *indices.entry(navigation.clone()).or_insert_with(|| {
                        let index = output.len();
                        output.push(navigation);
                        index
                    });
                    element.set("data-mokly-inspector-link", index.to_string());
                }
                pending.extend(element.children.iter_mut().rev());
            }
            Node::Region { children, .. } => pending.extend(children.iter_mut().rev()),
            _ => {}
        }
    }
    Ok(())
}

fn clear_links(nodes: &mut [Node]) {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Element(element) => {
                element.take("data-mokly-inspector-link");
                pending.extend(element.children.iter_mut().rev());
            }
            Node::Region { children, .. } => pending.extend(children.iter_mut().rev()),
            _ => {}
        }
    }
}

fn head(nodes: &mut [Node], additions: &[Node]) -> bool {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node
            && element.is_html()
            && element.name == "head"
        {
            element.children.extend_from_slice(additions);
            return true;
        }
        if let Some(children) = node.children_mut() {
            pending.extend(children.iter_mut().rev());
        }
    }
    false
}

fn wire_fragment(fragment: &str) -> bool {
    fragment
        .as_bytes()
        .first()
        .is_some_and(u8::is_ascii_alphabetic)
        && fragment
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"_:.-".contains(&byte))
}

fn wire_link(link: &Navigation) -> bool {
    link.screen_path.len() <= 256
        && link
            .fragment
            .as_ref()
            .is_none_or(|fragment| fragment.len() <= 256 && wire_fragment(fragment))
        && !matches!(&link.target, Target::Named { name } if name.len() > 256)
}
