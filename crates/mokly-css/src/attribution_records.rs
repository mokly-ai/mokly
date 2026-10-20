//! One wire-record reduction shared by owned, ownerless, and linked CSS.

use std::collections::BTreeSet;

use mokly_model::evidence::{EvidenceOwner, RuleEvidence, RuleStatus};
use mokly_model::review_order::rule_key;

use crate::attribution::{OwnPageMatches, PageObservation};
use crate::attribution_membership;

pub(crate) fn reduce(
    pages: &[PageObservation],
    changed: &OwnPageMatches,
    unfiltered: &OwnPageMatches,
) -> Vec<Vec<RuleEvidence>> {
    pages
        .iter()
        .map(|page| {
            let mut records = Vec::new();
            let mut examined = BTreeSet::new();
            for rule in &page.rules {
                examined.insert(rule.stylesheet.clone());
                for selector in &rule.selectors {
                    if !selector.unresolved && selector.matches.is_empty() {
                        continue;
                    }
                    let changed = changed.get(&rule.identity);
                    let owners: BTreeSet<_> = if selector.unresolved {
                        BTreeSet::from([None])
                    } else {
                        selector
                            .matches
                            .iter()
                            .map(|matched| {
                                attribution_membership::owner(
                                    matched,
                                    changed,
                                    unfiltered.get(&rule.identity),
                                )
                            })
                            .collect()
                    };
                    for owner in owners {
                        records.push(RuleEvidence {
                            stylesheet: rule.stylesheet.clone(),
                            selector: selector.selector.clone(),
                            status: if selector.unresolved {
                                RuleStatus::Unresolved
                            } else {
                                RuleStatus::Matched
                            },
                            owner: owner.map_or(EvidenceOwner::Entry, |path| {
                                EvidenceOwner::Component { path }
                            }),
                        });
                    }
                }
            }
            for stylesheet in examined {
                if !records.iter().any(|record| record.stylesheet == stylesheet) {
                    records.push(RuleEvidence {
                        stylesheet,
                        selector: String::new(),
                        status: RuleStatus::Excluded,
                        owner: EvidenceOwner::Entry,
                    });
                }
            }
            records.sort_by(|left, right| rule_key(left).cmp(&rule_key(right)));
            records.dedup();
            records
        })
        .collect()
}
