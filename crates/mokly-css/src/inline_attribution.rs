//! Ownerless head rules share catalogue-wide rule identity and use input ownership.

use mokly_model::evidence::EvidenceOwner;

use crate::attribution::{self, RuleObservation};
use crate::match_tree::MatchTree;
use crate::rule_matching::DocumentMatching;

/// Retain inline matches for the same own-page proof used by linked stylesheets.
/// A supplied slot can prove only its input owner, never its receiving component.
pub fn observe(
    stylesheet: &str,
    matching: &DocumentMatching,
    before: Option<&MatchTree>,
    after: Option<&MatchTree>,
) -> Vec<RuleObservation> {
    let mut rules = attribution::observe(stylesheet, matching, before, after);
    for matched in rules
        .iter_mut()
        .flat_map(|rule| &mut rule.selectors)
        .flat_map(|selector| &mut selector.matches)
    {
        matched.regions.retain(|region| matches!(&matched.owner, EvidenceOwner::Component { path } if path == &region.path));
    }
    rules
}
