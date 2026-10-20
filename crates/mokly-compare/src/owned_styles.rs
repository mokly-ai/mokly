//! Trusted sidecar rules retain their owners and per-rule document evidence.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::match_tree::MatchTree;
use mokly_css::rule_matching::{DocumentMatching, match_document};
use mokly_css::rules::{ParsedCss, RuleDiff};
use mokly_html::tree::{Node, RegionKind};
use mokly_model::evidence::{EvidenceOwner, RuleEvidence, RuleStatus};
use mokly_model::review_affected::ReviewSide;

use crate::error::Result;
use crate::material::mapped;
use crate::owned_style_instances;
use crate::resource_memo::ResourceMemo;
use crate::view_material::MaterialComparison;

#[derive(Default)]
pub(crate) struct Changes {
    owners: BTreeSet<String>,
    instances: BTreeSet<String>,
    pub(crate) rules: Vec<RuleEvidence>,
}

/// Page evidence and exact instance proof have independent ownership reductions.
struct OwnedRuleProof {
    records: Vec<RuleEvidence>,
    instances: BTreeSet<String>,
}

pub(crate) fn compare(
    nodes: [&[Node]; 2],
    trees: [Option<&MatchTree>; 2],
    paths: &BTreeMap<String, String>,
    route: &str,
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
        let matching = match_document(&diff, trees[0], trees[1]);
        let indices = indices.get_or_insert_with(|| {
            [
                owned_style_instances::index(nodes[0], paths),
                owned_style_instances::index(nodes[1], &BTreeMap::new()),
            ]
        });
        let proof = prove(&matching, owner, trees, indices, route);
        if !proof.records.is_empty() {
            changes.owners.insert(owner.clone());
        }
        changes.rules.extend(proof.records);
        changes.instances.extend(proof.instances);
    }
    Ok(changes)
}

fn prove(
    matching: &DocumentMatching,
    owner: &str,
    trees: [Option<&MatchTree>; 2],
    indices: &[owned_style_instances::Index; 2],
    route: &str,
) -> OwnedRuleProof {
    OwnedRuleProof {
        records: records(matching, owner, trees, route),
        instances: owned_style_instances::matched(matching, owner, indices),
    }
}

pub(crate) fn apply(comparison: &mut MaterialComparison, changes: &Changes) {
    for instance in &mut comparison.instances {
        instance.render_changed |= changes.instances.contains(&instance.key);
    }
}

impl Changes {
    pub(crate) fn changes_owner(&self, owner: Option<&str>) -> bool {
        owner.is_some_and(|owner| self.owners.contains(owner))
    }
}

fn records(
    matching: &DocumentMatching,
    owner: &str,
    trees: [Option<&MatchTree>; 2],
    route: &str,
) -> Vec<RuleEvidence> {
    let record = |selector: String, status| RuleEvidence {
        stylesheet: route.into(),
        selector,
        owner: if status == RuleStatus::Unresolved {
            EvidenceOwner::Entry
        } else {
            EvidenceOwner::Component { path: owner.into() }
        },
        status,
    };
    let DocumentMatching::Resolved(rules) = matching else {
        return vec![record(String::new(), RuleStatus::Unresolved)];
    };
    rules
        .iter()
        .flat_map(|rule| &rule.selectors)
        .filter_map(|selector| {
            if selector.unresolved {
                return Some(record(selector.selector.clone(), RuleStatus::Unresolved));
            }
            let kept = selector.elements.iter().any(|matched| {
                let side = usize::from(matched.side == ReviewSide::After);
                let Some(element) = trees[side].and_then(|tree| tree.elements.get(matched.element))
                else {
                    return false;
                };
                let own_page = element
                    .regions
                    .iter()
                    .any(|region| region.root && region.path == owner);
                let nested = element.regions.iter().rev().find(|region| !region.root);
                if own_page {
                    nested.is_none()
                } else {
                    nested.is_none_or(|region| region.path == owner)
                }
            });
            kept.then(|| record(selector.selector.clone(), RuleStatus::Matched))
        })
        .collect()
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
