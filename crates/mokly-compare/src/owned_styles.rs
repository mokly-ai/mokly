//! Trusted sidecar rules enter the shared catalogue-wide evidence reducer.

use std::collections::{BTreeMap, BTreeSet};
use std::mem;

use mokly_css::attribution::{self, OwnPageMatches, RuleObservation};
use mokly_css::match_tree::MatchTree;
use mokly_css::rule_matching::{DocumentMatching, match_document};
use mokly_css::rules::{ParsedCss, RuleDiff};
use mokly_html::tree::{Node, RegionKind};
use mokly_model::catalogue::ModelEntry;
use mokly_model::review::EntryChangeReason;

use crate::comparison_address::address;
use crate::comparison_types::ViewKey;
use crate::error::Result;
use crate::instance_proof::InstanceProof;
use crate::material::mapped;
use crate::owned_style_instances;
use crate::resource_memo::ResourceMemo;
use crate::view_material::MaterialComparison;

#[derive(Default)]
pub(crate) struct Changes {
    pub(crate) rules: Vec<RuleObservation>,
    matching: Vec<(String, DocumentMatching)>,
    indices: Option<[owned_style_instances::Index; 2]>,
    potential: Vec<InstanceProof>,
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
        let rules = attribution::observe_owned(route, &matching, trees[0], trees[1], Some(owner));
        changes.rules.extend(rules);
        changes.matching.push((owner.clone(), matching));
    }
    if !changes.matching.is_empty() {
        changes.indices = Some([
            owned_style_instances::index(nodes[0], paths),
            owned_style_instances::index(nodes[1], &BTreeMap::new()),
        ]);
    }
    Ok(changes)
}

impl Changes {
    /// Move admission follows physical claims for declared owned rules.
    pub(crate) fn changes_owner(&self, owner: Option<&str>) -> bool {
        let Some(owner) = owner else {
            return false;
        };
        self.rules
            .iter()
            .flat_map(|rule| &rule.selectors)
            .any(|selector| {
                selector.unresolved
                    || selector.matches.iter().any(|matched| {
                        if matched.trusted_owner.as_deref() != Some(owner) {
                            return false;
                        }
                        matched.regions().any(|region| region.path == owner)
                    })
            })
    }

    /// Retain only paired instances whose caller inputs stayed equal.
    pub(crate) fn prepare(
        &mut self,
        comparison: &MaterialComparison,
        before: &ModelEntry,
        after: &ModelEntry,
        view: ViewKey,
    ) {
        if self.matching.is_empty() {
            return;
        }
        self.potential = comparison
            .instances
            .iter()
            .map(|instance| InstanceProof {
                component: instance.component.clone(),
                instance: instance.key.clone(),
                before: address(before),
                after: address(after),
                view,
                reason: EntryChangeReason::Implementation,
                reference: None,
            })
            .collect();
    }

    /// Resolve exact instance proof with the same unfiltered own-page sets as records.
    pub(crate) fn proofs(&mut self, own_pages: &OwnPageMatches) -> Vec<InstanceProof> {
        let Some(indices) = &self.indices else {
            return Vec::new();
        };
        let mut instances = BTreeSet::new();
        for (owner, matching) in &self.matching {
            instances.extend(owned_style_instances::matched(
                matching, owner, indices, own_pages,
            ));
        }
        mem::take(&mut self.potential)
            .into_iter()
            .filter(|proof| instances.contains(&proof.instance))
            .collect()
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
