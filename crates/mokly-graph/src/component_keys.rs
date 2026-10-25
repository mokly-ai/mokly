//! Content keys follow component dependencies with explicit depth-first work records.

use std::collections::{BTreeMap, BTreeSet};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::{parse, tree};

use crate::error::{Result, invalid};
use crate::key::{NodeKey, NodeKind, key};

enum Work {
    Enter(String),
    Finish {
        path: String,
        inputs: Vec<String>,
        children: BTreeSet<String>,
    },
}

pub(crate) fn resolve(
    path: &str,
    catalogue: &PreparedCatalogue,
    sources: &BTreeMap<String, NodeKey>,
    keys: &mut BTreeMap<String, NodeKey>,
    visiting: &mut BTreeSet<String>,
) -> Result<NodeKey> {
    let mut pending = vec![Work::Enter(path.into())];
    while let Some(work) = pending.pop() {
        match work {
            Work::Enter(path) => {
                if keys.contains_key(&path) {
                    continue;
                }
                if !visiting.insert(path.clone()) {
                    return Err(invalid(&path, "component dependency cycle"));
                }
                let source = catalogue
                    .model
                    .entries
                    .iter()
                    .find(|entry| entry.metadata.path == path)
                    .and_then(|entry| sources.get(&entry.metadata.source.path))
                    .ok_or_else(|| invalid(&path, "component source key is missing"))?;
                let mut inputs = vec![source.0.clone(), path.clone()];
                inputs.extend(
                    catalogue
                        .elements
                        .iter()
                        .filter(|(_, element)| element.path == path)
                        .map(|(name, _)| name.clone()),
                );
                let children = catalogue
                    .templates
                    .get(&path)
                    .map(|template| direct(&template.body, catalogue))
                    .unwrap_or_default();
                let next: Vec<_> = children
                    .iter()
                    .rev()
                    .filter(|child| **child != path)
                    .cloned()
                    .collect();
                pending.push(Work::Finish {
                    path,
                    inputs,
                    children,
                });
                pending.extend(next.into_iter().map(Work::Enter));
            }
            Work::Finish {
                path,
                mut inputs,
                children,
            } => {
                for child in children.into_iter().filter(|child| child != &path) {
                    let child_key = keys
                        .get(&child)
                        .ok_or_else(|| invalid(&child, "component source key is missing"))?;
                    inputs.push(child_key.0.clone());
                }
                let result = key(
                    NodeKind::HtmlComponent,
                    &inputs
                        .iter()
                        .map(|input| input.as_bytes())
                        .collect::<Vec<_>>(),
                );
                visiting.remove(&path);
                keys.insert(path, result);
            }
        }
    }
    keys.get(path)
        .cloned()
        .ok_or_else(|| invalid(path, "component source key is missing"))
}

pub(crate) fn direct(body: &str, catalogue: &PreparedCatalogue) -> BTreeSet<String> {
    let nodes = parse::fragment(body);
    tree::walk(&nodes)
        .filter_map(|node| match node {
            tree::Node::Element(element) => catalogue
                .elements
                .get(&element.name)
                .map(|component| component.path.clone()),
            _ => None,
        })
        .collect()
}
