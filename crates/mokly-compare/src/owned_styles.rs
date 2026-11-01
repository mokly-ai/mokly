//! Trusted sidecar rules enter the shared catalogue-wide evidence reducer.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::attribution::{self, OwnPageMatches, RuleObservation};
use mokly_css::match_tree::MatchTree;
use mokly_css::rule_matching::{DocumentMatching, match_document};
use mokly_css::rules::{ParsedCss, RuleDiff};
use mokly_html::tree::{Node, RegionKind};
use mokly_model::catalogue::ModelEntry;
use mokly_model::review::{EntryChangeReason, ReviewEntryAddress};

use crate::comparison_address::address;
use crate::comparison_types::ViewKey;
use crate::error::Result;
use crate::instance_impact::PairedInstance;
use crate::instance_proof::InstanceProof;
use crate::material::mapped;
use crate::owned_style_chain_source::DocumentIndex;
use crate::owned_style_instances;
use crate::resource_memo::ResourceMemo;
use crate::view_material::MaterialComparison;

#[derive(Default)]
pub(crate) struct Changes {
    pub(crate) rules: Vec<RuleObservation>,
    chains: Vec<(String, owned_style_instances::Compact)>,
    proof: Option<ProofContext>,
}

struct ProofContext {
    candidates: Vec<(String, String)>,
    before: ReviewEntryAddress,
    after: ReviewEntryAddress,
    view: ViewKey,
}

/// Compare owned rules and retain ancestry only for eligible paired instances.
pub(crate) fn compare(
    nodes: [&[Node]; 2],
    trees: [Option<&MatchTree>; 2],
    paths: &BTreeMap<String, String>,
    route: &str,
    memo: &dyn ResourceMemo,
    instances: &[PairedInstance],
) -> Result<Changes> {
    let before = collect(nodes[0], paths);
    let after = collect(nodes[1], &BTreeMap::new());
    let owners: BTreeSet<_> = before.keys().chain(after.keys()).collect();
    let mut changes = Changes::default();
    let mut indices = None;
    let mut eligible = None;
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
        if instances.is_empty() || !matches!(matching, DocumentMatching::Resolved(_)) {
            continue;
        }
        let eligible = eligible.get_or_insert_with(|| {
            let mut eligible = BTreeMap::<_, BTreeSet<_>>::new();
            for instance in instances {
                eligible
                    .entry(instance.component.as_str())
                    .or_default()
                    .insert(instance.key.as_str());
            }
            eligible
        });
        let Some(candidates) = eligible.get(owner.as_str()) else {
            continue;
        };
        let indices = indices.get_or_insert_with(|| {
            [
                DocumentIndex::build(nodes[0], paths),
                DocumentIndex::build(nodes[1], &BTreeMap::new()),
            ]
        });
        let chains = owned_style_instances::compact(indices, &matching, owner, candidates);
        if !chains.is_empty() {
            changes.chains.push((owner.clone(), chains));
        }
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
        if self.chains.is_empty() {
            return;
        }
        let candidate_keys: BTreeSet<_> = self
            .chains
            .iter()
            .flat_map(|(owner, chains)| owned_style_instances::candidates(chains, owner))
            .collect();
        let candidates: Vec<_> = comparison
            .instances
            .iter()
            .filter(|instance| candidate_keys.contains(&instance.key))
            .map(|instance| (instance.component.clone(), instance.key.clone()))
            .collect();
        self.proof = (!candidates.is_empty()).then(|| ProofContext {
            candidates,
            before: address(before),
            after: address(after),
            view,
        });
    }

    /// Resolve exact instance proof with the same unfiltered own-page sets as records.
    pub(crate) fn proofs(&mut self, own_pages: &OwnPageMatches) -> Vec<InstanceProof> {
        let Some(proof) = self.proof.take() else {
            return Vec::new();
        };
        let mut instances = BTreeSet::new();
        for (owner, chains) in &self.chains {
            instances.extend(owned_style_instances::matched(chains, owner, own_pages));
        }
        proof
            .candidates
            .into_iter()
            .filter_map(|(component, instance)| {
                instances.contains(&instance).then(|| InstanceProof {
                    component,
                    instance,
                    before: proof.before.clone(),
                    after: proof.after.clone(),
                    view: proof.view,
                    reason: EntryChangeReason::Implementation,
                    reference: None,
                })
            })
            .collect()
    }

    /// Count retained chain instances, per-rule starts, and paired candidates.
    #[cfg(test)]
    pub(crate) fn retained_counts(&self) -> (usize, usize, usize) {
        let (chains, starts) = self.chains.iter().map(|(_, chains)| chains.counts()).fold(
            (0, 0),
            |(chains, starts), (next_chains, next_starts)| {
                (chains + next_chains, starts + next_starts)
            },
        );
        (
            chains,
            starts,
            self.proof
                .as_ref()
                .map_or(0, |proof| proof.candidates.len()),
        )
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
                if let Some(records) = &element.style_attribution {
                    for record in records {
                        for owner in &record.owners {
                            output
                                .entry(mapped(owner, paths))
                                .or_default()
                                .insert(record.css.clone());
                        }
                    }
                } else if let Some(owners) = &element.style_owners {
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

#[cfg(test)]
#[path = "_tests_/owned_proof/mod.rs"]
mod owned_proof_tests;
