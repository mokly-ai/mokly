//! Count every owned rule string and vector without counting shared ancestry twice.

use std::mem;

use mokly_css::attribution::{MatchProof, RuleIdentity, RuleObservation, SelectorProof};

pub(crate) fn rules(rules: &Vec<RuleObservation>) -> usize {
    rules.capacity() * mem::size_of::<RuleObservation>()
        + rules
            .iter()
            .map(|rule| {
                rule.stylesheet.capacity()
                    + identity(&rule.identity)
                    + rule.selectors.capacity() * mem::size_of::<SelectorProof>()
                    + rule
                        .selectors
                        .iter()
                        .map(|selector| {
                            selector.selector.capacity()
                                + selector.matches.capacity() * mem::size_of::<MatchProof>()
                                + selector
                                    .matches
                                    .iter()
                                    .map(|proof| {
                                        proof.trusted_owner.as_ref().map_or(0, String::capacity)
                                    })
                                    .sum::<usize>()
                        })
                        .sum::<usize>()
            })
            .sum::<usize>()
}

fn identity(identity: &RuleIdentity) -> usize {
    [&identity.0, &identity.1]
        .into_iter()
        .flatten()
        .map(|(selectors, declarations)| {
            selectors.capacity() * mem::size_of::<String>()
                + selectors.iter().map(String::capacity).sum::<usize>()
                + declarations.capacity()
        })
        .sum()
}
