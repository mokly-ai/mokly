//! Unowned head-style seam for whole-screen sidecar renders and authored page styles.

use std::collections::BTreeSet;

use mokly_model::evidence::{EvidenceOwner, RuleEvidence, RuleStatus};

use crate::attribution::observe;
use crate::match_tree::MatchTree;
use crate::rule_matching::DocumentMatching;

/// Inline rules use all-match ownership rather than linked-CSS own-page membership.
#[derive(Clone, Debug)]
pub struct InlineAttribution {
    /// One owner-attributed record per retained selector, or one excluded sheet.
    pub rules: Vec<RuleEvidence>,
    /// Component implementation impact proved by one-component containment.
    pub components: BTreeSet<String>,
}

/// Attribute a head style diff using the single owner containing every match.
pub fn attribute(
    stylesheet: &str,
    matching: &DocumentMatching,
    before: Option<&MatchTree>,
    after: Option<&MatchTree>,
) -> InlineAttribution {
    let observations = observe(stylesheet, matching, before, after);
    let mut rules = Vec::new();
    let mut components = BTreeSet::new();
    for rule in &observations {
        for selector in &rule.selectors {
            if !selector.unresolved && selector.matches.is_empty() {
                continue;
            }
            let owner = if !selector.unresolved {
                selector
                    .matches
                    .first()
                    .map(|matched| matched.owner.clone())
                    .filter(|owner| {
                        matches!(owner, EvidenceOwner::Component { .. })
                            && selector
                                .matches
                                .iter()
                                .all(|matched| &matched.owner == owner)
                    })
                    .unwrap_or(EvidenceOwner::Entry)
            } else {
                EvidenceOwner::Entry
            };
            if let EvidenceOwner::Component { path } = &owner {
                components.insert(path.clone());
            }
            rules.push(RuleEvidence {
                stylesheet: stylesheet.into(),
                selector: selector.selector.clone(),
                status: if selector.unresolved {
                    RuleStatus::Unresolved
                } else {
                    RuleStatus::Matched
                },
                owner,
            });
        }
    }
    if rules.is_empty() && !observations.is_empty() {
        rules.push(RuleEvidence {
            stylesheet: stylesheet.into(),
            selector: String::new(),
            status: RuleStatus::Excluded,
            owner: EvidenceOwner::Entry,
        });
    }
    InlineAttribution { rules, components }
}
