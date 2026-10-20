//! Head rules use the same physical observation boundary as linked stylesheets.

use crate::attribution::{self, RuleObservation};
use crate::match_tree::MatchTree;
use crate::rule_matching::DocumentMatching;

/// Retain physical containment for catalogue-wide own-page attribution.
pub fn observe(
    stylesheet: &str,
    matching: &DocumentMatching,
    before: Option<&MatchTree>,
    after: Option<&MatchTree>,
) -> Vec<RuleObservation> {
    attribution::observe(stylesheet, matching, before, after)
}
