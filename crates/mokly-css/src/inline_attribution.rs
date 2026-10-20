//! Head rules retain supplier ancestry through the shared observation boundary.

use crate::attribution::{self, RuleObservation};
use crate::match_tree::MatchTree;
use crate::rule_matching::DocumentMatching;

/// Retain supplier input ancestry without exposing receiving component regions.
pub fn observe(
    stylesheet: &str,
    matching: &DocumentMatching,
    before: Option<&MatchTree>,
    after: Option<&MatchTree>,
) -> Vec<RuleObservation> {
    attribution::observe_ancestry(stylesheet, matching, before, after, true)
}
