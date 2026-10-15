//! Linked CSS matches in its composed document, including embedded HTML and srcdoc.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use mokly_css::match_tree::MatchTree;
use mokly_graph::urls::local_target;
use mokly_html::parse;

use crate::error::Result;
use crate::matching_tree;
use crate::resource_memo::ResourceMemo;
use mokly_model::review_affected::ReviewSide;

pub(crate) struct CssDocument {
    pub(crate) id: String,
    pub(crate) tree: MatchTree,
    pub(crate) stylesheets: BTreeSet<String>,
}

pub(crate) fn collect(
    memo: &dyn ResourceMemo,
    side: ReviewSide,
    source: &str,
    root: Option<&MatchTree>,
    aliases: &BTreeMap<String, String>,
) -> Result<Vec<CssDocument>> {
    let Some(root) = root else {
        return Ok(Vec::new());
    };
    let mut queue = VecDeque::from([(String::from("root"), source.to_owned(), root.clone())]);
    let mut visited = BTreeSet::new();
    let mut documents = Vec::new();
    while let Some((id, source, tree)) = queue.pop_front() {
        if !visited.insert(id.clone()) {
            continue;
        }
        let mut stylesheets = BTreeSet::new();
        for (index, element) in tree.elements.iter().enumerate() {
            if element.name == "link"
                && element.attributes.get("rel").is_some_and(|rel| {
                    rel.split_ascii_whitespace()
                        .any(|value| value.eq_ignore_ascii_case("stylesheet"))
                })
                && let Some(href) = element.attributes.get("href")
                && let Ok(Some(route)) = local_target(&source, href)
            {
                imports(memo, side, &route, aliases, &mut stylesheets)?;
            }
            if !matches!(element.name.as_str(), "iframe" | "object" | "embed") {
                continue;
            }
            if let Some(srcdoc) = element.attributes.get("srcdoc") {
                let embedded = matching_tree::embedded(
                    &parse::document(srcdoc),
                    &element.regions,
                    &element.owner,
                );
                queue.push_back((format!("{id}#srcdoc-{index}"), source.clone(), embedded));
                continue;
            }
            let attribute = if element.name == "object" {
                "data"
            } else {
                "src"
            };
            let Some(reference) = element.attributes.get(attribute) else {
                continue;
            };
            let Ok(Some(route)) = local_target(&source, reference) else {
                continue;
            };
            if !route.ends_with(".html") && !route.ends_with(".htm") {
                continue;
            }
            let Some(bytes) = memo.read(side, &route)? else {
                continue;
            };
            let nodes = parse::document(&String::from_utf8_lossy(&bytes));
            let embedded = matching_tree::embedded(&nodes, &element.regions, &element.owner);
            let id = aliases.get(&route).unwrap_or(&route).clone();
            queue.push_back((id, route, embedded));
        }
        documents.push(CssDocument {
            id,
            tree,
            stylesheets,
        });
    }
    Ok(documents)
}

fn imports(
    memo: &dyn ResourceMemo,
    side: ReviewSide,
    route: &str,
    aliases: &BTreeMap<String, String>,
    output: &mut BTreeSet<String>,
) -> Result<()> {
    let mut queue = vec![route.to_owned()];
    while let Some(route) = queue.pop() {
        let identity = aliases.get(&route).unwrap_or(&route);
        if !output.insert(identity.clone()) {
            continue;
        }
        queue.extend(memo.fact(side, &route)?.imports);
    }
    Ok(())
}
