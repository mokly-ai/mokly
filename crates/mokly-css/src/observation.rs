//! Union proof from repeated changed rules and embedded document contexts before reduction.

use std::collections::BTreeMap;

use crate::attribution::{RuleIdentity, RuleObservation, SelectorProof};

/// Equal changed tuples share proof while each delivered stylesheet keeps its own records.
pub fn merge(observations: Vec<RuleObservation>) -> Vec<RuleObservation> {
    let mut groups: BTreeMap<(String, RuleIdentity), BTreeMap<String, SelectorProof>> =
        BTreeMap::new();
    for observation in observations {
        let selectors = groups
            .entry((observation.stylesheet, observation.identity))
            .or_default();
        for proof in observation.selectors {
            let selector =
                selectors
                    .entry(proof.selector.clone())
                    .or_insert_with(|| SelectorProof {
                        selector: proof.selector.clone(),
                        unresolved: false,
                        matches: Vec::new(),
                    });
            selector.unresolved |= proof.unresolved;
            selector.matches.extend(proof.matches);
        }
    }
    groups
        .into_iter()
        .map(|((stylesheet, identity), selectors)| RuleObservation {
            stylesheet,
            identity,
            selectors: selectors.into_values().collect(),
        })
        .collect()
}
