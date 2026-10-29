//! Selector matches retain only the instance chains needed for owned proof.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::attribution::{OwnPageMatches, RuleIdentity};
use mokly_css::rule_matching::DocumentMatching;
use mokly_css::rules::BorrowedRuleIdentity;
use mokly_model::review_affected::ReviewSide;

use crate::owned_style_chain_source::{DocumentIndex, Instance};

#[derive(Clone, Copy, Eq, Ord, PartialEq, PartialOrd)]
struct Start {
    parent: Option<usize>,
    input: Option<usize>,
}

struct RuleChains {
    identity: RuleIdentity,
    starts: [Vec<Start>; 2],
}

/// Compact ancestry retained for one changed owned style owner.
#[derive(Default)]
pub(crate) struct Compact {
    instances: [Vec<Instance>; 2],
    rules: Vec<RuleChains>,
}

/// Retain only deduplicated parent and input-owner chains of matched elements.
pub(crate) fn compact(documents: &[DocumentIndex; 2], matching: &DocumentMatching) -> Compact {
    let DocumentMatching::Resolved(rules) = matching else {
        return Compact::default();
    };
    let mut result = Compact::default();
    let mut rule_indices = BTreeMap::new();
    let mut start_sets = Vec::<[BTreeSet<Start>; 2]>::new();
    for rule in rules {
        let identity = owned_identity(rule.change.identity());
        let rule_index = *rule_indices.entry(identity.clone()).or_insert_with(|| {
            let index = result.rules.len();
            result.rules.push(RuleChains {
                identity,
                starts: [Vec::new(), Vec::new()],
            });
            start_sets.push([BTreeSet::new(), BTreeSet::new()]);
            index
        });
        for selector in &rule.selectors {
            if selector.unresolved {
                continue;
            }
            for element in &selector.elements {
                let side = usize::from(element.side == ReviewSide::After);
                let Some(&(parent, input)) = documents[side].elements.get(element.element) else {
                    continue;
                };
                let start = Start { parent, input };
                if start_sets[rule_index][side].insert(start) {
                    result.rules[rule_index].starts[side].push(start);
                }
            }
        }
    }
    for (side, document) in documents.iter().enumerate() {
        result.retain(side, document);
    }
    result
}

/// Return the instance keys a compact chain could produce for an owner.
pub(crate) fn candidates(compact: &Compact, owner: &str) -> BTreeSet<String> {
    matched(compact, owner, &OwnPageMatches::new())
}

/// Resolve compact chains using catalogue-wide own-page membership.
pub(crate) fn matched(
    compact: &Compact,
    owner: &str,
    own_pages: &OwnPageMatches,
) -> BTreeSet<String> {
    let mut output = BTreeSet::new();
    for rule in &compact.rules {
        let mut seen = [BTreeSet::new(), BTreeSet::new()];
        let pages = own_pages.get(&rule.identity);
        for (side, seen_side) in seen.iter_mut().enumerate() {
            for start in &rule.starts[side] {
                collect(
                    &compact.instances[side],
                    *start,
                    owner,
                    pages,
                    seen_side,
                    &mut output,
                );
            }
        }
    }
    output
}

impl Compact {
    fn retain(&mut self, side: usize, source: &DocumentIndex) {
        let mut parents = BTreeSet::new();
        let mut inputs = BTreeSet::new();
        for rule in &self.rules {
            for start in &rule.starts[side] {
                let mut parent = start.parent;
                while let Some(index) = parent {
                    if !parents.insert(index) {
                        break;
                    }
                    parent = source.instances[index].parent;
                }
                let mut input = start.input;
                while let Some(index) = input {
                    if !inputs.insert(index) {
                        break;
                    }
                    input = source.instances[index].input_parent;
                }
            }
        }
        let map: BTreeMap<_, _> = parents
            .union(&inputs)
            .enumerate()
            .map(|(new, old)| (*old, new))
            .collect();
        self.instances[side] = map
            .keys()
            .map(|index| {
                let instance = &source.instances[*index];
                Instance {
                    path: instance.path.clone(),
                    key: instance.key.clone(),
                    parent: parents
                        .contains(index)
                        .then_some(instance.parent)
                        .flatten()
                        .and_then(|index| map.get(&index).copied()),
                    input_parent: inputs
                        .contains(index)
                        .then_some(instance.input_parent)
                        .flatten()
                        .and_then(|index| map.get(&index).copied()),
                }
            })
            .collect();
        for rule in &mut self.rules {
            for start in &mut rule.starts[side] {
                start.parent = start.parent.and_then(|index| map.get(&index).copied());
                start.input = start.input.and_then(|index| map.get(&index).copied());
            }
        }
    }

    /// Count the compact state retained after document matching is released.
    #[cfg(test)]
    pub(crate) fn counts(&self) -> (usize, usize) {
        (
            self.instances.iter().map(Vec::len).sum(),
            self.rules
                .iter()
                .map(|rule| rule.starts.iter().map(Vec::len).sum::<usize>())
                .sum(),
        )
    }
}

fn collect(
    instances: &[Instance],
    start: Start,
    owner: &str,
    own_pages: Option<&BTreeSet<String>>,
    seen: &mut BTreeSet<(usize, Option<usize>)>,
    output: &mut BTreeSet<String>,
) {
    let blocked =
        std::iter::successors(start.input, |index| instances[*index].input_parent).find(|index| {
            let instance = &instances[*index];
            instance.path != owner && own_pages.is_some_and(|pages| pages.contains(&instance.path))
        });
    let mut parent = start.parent;
    while let Some(index) = parent {
        if !seen.insert((index, blocked)) {
            break;
        }
        let instance = &instances[index];
        if Some(index) == blocked {
            break;
        }
        if instance.path == owner {
            output.insert(instance.key.clone());
        }
        parent = instance.parent;
    }
}

fn owned_identity(identity: BorrowedRuleIdentity<'_>) -> RuleIdentity {
    (
        identity
            .0
            .map(|(selectors, declarations)| (selectors.to_vec(), declarations.to_owned())),
        identity
            .1
            .map(|(selectors, declarations)| (selectors.to_vec(), declarations.to_owned())),
    )
}

#[cfg(test)]
#[path = "_tests_/owned_style_instances_tests.rs"]
mod owned_style_instances_tests;
