//! Trusted sidecar styles are component material, independent of linked-CSS membership.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::match_tree::MatchTree;
use mokly_css::rule_matching::match_document;
use mokly_css::rules::{ParsedCss, RuleDiff};
use mokly_html::tree::{Node, RegionKind};

use crate::error::Result;
use crate::material::mapped;
use crate::owned_style_instances;
use crate::resource_memo::ResourceMemo;
use crate::view_material::MaterialComparison;

#[derive(Default)]
pub(crate) struct Changes {
    owners: BTreeSet<String>,
    instances: BTreeSet<String>,
}

pub(crate) fn compare(
    nodes: [&[Node]; 2],
    trees: [Option<&MatchTree>; 2],
    paths: &BTreeMap<String, String>,
    memo: &dyn ResourceMemo,
) -> Result<Changes> {
    let before = collect(nodes[0], paths);
    let after = collect(nodes[1], &BTreeMap::new());
    let owners: BTreeSet<_> = before.keys().chain(after.keys()).collect();
    let mut changes = Changes::default();
    let mut indices = None;
    for owner in owners {
        let left = before.get(owner).cloned().unwrap_or_default();
        let right = after.get(owner).cloned().unwrap_or_default();
        if left == right {
            continue;
        }
        let diff = memo.owned_diff(left.as_bytes(), right.as_bytes())?;
        if matches!(diff.as_ref(), RuleDiff::Resolved { added, removed, changed }
            if added.is_empty() && removed.is_empty() && changed.is_empty())
        {
            continue;
        }
        changes.owners.insert(owner.clone());
        let indices = indices.get_or_insert_with(|| {
            [
                owned_style_instances::index(nodes[0], paths),
                owned_style_instances::index(nodes[1], &BTreeMap::new()),
            ]
        });
        changes.instances.extend(owned_style_instances::matched(
            &match_document(&diff, trees[0], trees[1]),
            owner,
            indices,
        ));
    }
    Ok(changes)
}

pub(crate) fn apply(comparison: &mut MaterialComparison, owner: Option<&str>, changes: &Changes) {
    if owner.is_some_and(|owner| changes.owners.contains(owner)) {
        comparison.changed = true;
        comparison.root_changed = true;
        comparison.ignored_only = false;
    }
    for instance in &mut comparison.instances {
        instance.render_changed |= changes.instances.contains(&instance.key);
    }
}

/// Repeated sidecar rule copies do not change component material.
pub(crate) fn unique(css: &ParsedCss) -> ParsedCss {
    match css {
        ParsedCss::Failed(error) => ParsedCss::Failed(error.clone()),
        ParsedCss::Rules(rules) => {
            let rules: BTreeSet<_> = rules
                .iter()
                .cloned()
                .map(|mut rule| {
                    rule.ordinal = 0;
                    rule
                })
                .collect();
            ParsedCss::Rules(
                rules
                    .into_iter()
                    .enumerate()
                    .map(|(ordinal, mut rule)| {
                        rule.ordinal = ordinal;
                        rule
                    })
                    .collect(),
            )
        }
    }
}

fn collect(nodes: &[Node], paths: &BTreeMap<String, String>) -> BTreeMap<String, String> {
    let mut styles = BTreeMap::<String, BTreeSet<String>>::new();
    visit(nodes, paths, &mut styles);
    styles
        .into_iter()
        .map(|(owner, css)| (owner, css.into_iter().collect::<Vec<_>>().join("\n")))
        .collect()
}

fn visit(
    nodes: &[Node],
    paths: &BTreeMap<String, String>,
    output: &mut BTreeMap<String, BTreeSet<String>>,
) {
    let mut pending: Vec<_> = nodes.iter().rev().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Element(element) if element.name == "style" => {
                if let Some(owners) = &element.style_owners {
                    let css: String = element
                        .children
                        .iter()
                        .filter_map(|node| {
                            if let Node::Text(text) = node {
                                Some(text.as_str())
                            } else {
                                None
                            }
                        })
                        .collect();
                    for owner in owners {
                        output
                            .entry(mapped(owner, paths))
                            .or_default()
                            .insert(css.clone());
                    }
                }
            }
            Node::Element(element) if element.name != "template" => {
                pending.extend(element.children.iter().rev())
            }
            Node::Region { region, children }
                if !matches!(region.kind, RegionKind::Ignore { .. }) =>
            {
                pending.extend(children.iter().rev())
            }
            _ => {}
        }
    }
}

#[cfg(test)]
#[path = "_tests_/owned_styles_tests.rs"]
mod owned_styles_tests;
