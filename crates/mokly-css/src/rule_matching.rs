//! Pure per-rule matching against both composed documents with retained element proof.

use std::collections::BTreeMap;

use cssparser_next::Parser;
use mokly_model::review_affected::ReviewSide;
use selectors::context::{
    MatchingForInvalidation, MatchingMode, NeedsSelectorFlags, QuirksMode, SelectorCaches,
};
use selectors::matching::{MatchingContext, matches_selector_list};
use selectors::parser::{ParseRelative, SelectorList};

use crate::match_tree::MatchTree;
use crate::rules::{ConditionKind, Rule, RuleChange, RuleDiff, RuleFailure};
use crate::selector_element::Cursor;
use crate::selector_impl::SelectorParser;
use crate::selector_nesting::combine;
use crate::selector_scope::broaden;

/// Bound recursive :has() subtree matching with margin on a 2 MiB worker stack.
/// Measured dev frames use 288 bytes; an eightfold factor permits 910 levels.
/// Rounding down to 512 leaves room for selector matching and caller frames.
pub const MAX_HAS_TREE_DEPTH: usize = 512;

/// Actual element match, kept only until catalogue-wide attribution ends.
#[derive(Clone, Debug)]
pub struct ElementMatch {
    /// Side of the original tree.
    pub side: ReviewSide,
    /// Tree-local element index.
    pub element: usize,
}

/// One serialized selector and its conservative matching outcome.
#[derive(Clone, Debug)]
pub struct SelectorMatch {
    /// Original selector, before nesting substitution or state broadening.
    pub selector: String,
    /// An unsupported or conservative construct prevented proof.
    pub unresolved: bool,
    /// Every potential matching element on both available sides.
    pub elements: Vec<ElementMatch>,
}

/// Complete changed rule and retained match sets.
#[derive(Clone, Debug)]
pub struct MatchedRule {
    /// Original rule records, including both sides of edits.
    pub change: RuleChange,
    /// Original selector records in first occurrence order.
    pub selectors: Vec<SelectorMatch>,
}

/// Matching never reads files or emits classification records.
#[derive(Clone, Debug)]
pub enum DocumentMatching {
    /// Added, removed, then changed order, retaining ordinal order in each list.
    Resolved(Vec<MatchedRule>),
    /// Side-tagged whole-sheet failures without partial rule proof.
    Unresolved(Vec<RuleFailure>),
}

/// Match every selector of every diffed rule against both supplied documents.
pub fn match_document(
    diff: &RuleDiff,
    before: Option<&MatchTree>,
    after: Option<&MatchTree>,
) -> DocumentMatching {
    let RuleDiff::Resolved {
        added,
        removed,
        changed,
    } = diff
    else {
        let RuleDiff::Unresolved(failures) = diff else {
            return DocumentMatching::Resolved(Vec::new());
        };
        return DocumentMatching::Unresolved(failures.clone());
    };
    let invalid_tree =
        before.is_some_and(|tree| !tree.valid()) || after.is_some_and(|tree| !tree.valid());
    let deep_tree = !invalid_tree
        && before
            .into_iter()
            .chain(after)
            .any(|tree| tree.exceeds_depth(MAX_HAS_TREE_DEPTH));
    DocumentMatching::Resolved(
        added
            .iter()
            .chain(removed)
            .chain(changed)
            .map(|change| {
                let mut records: BTreeMap<String, SelectorMatch> = BTreeMap::new();
                let mut order = Vec::new();
                for rule in change.before.iter().chain(&change.after) {
                    let selectors = if rule.selectors.is_empty() {
                        vec![rule.at_rule.as_ref().map_or(String::new(), |at| {
                            format!(
                                "@{}{}{}",
                                at.name,
                                if at.prelude.is_empty() { "" } else { " " },
                                at.prelude
                            )
                        })]
                    } else {
                        rule.selectors.clone()
                    };
                    for original in selectors {
                        if !records.contains_key(&original) {
                            order.push(original.clone());
                        }
                        let record =
                            records
                                .entry(original.clone())
                                .or_insert_with(|| SelectorMatch {
                                    selector: original.clone(),
                                    unresolved: false,
                                    elements: Vec::new(),
                                });
                        let Some(combined) = nesting(rule, &original) else {
                            record.unresolved = true;
                            continue;
                        };
                        let scope = broaden(&combined);
                        if invalid_tree
                            || change.conservative()
                            || rule.selectors.is_empty()
                            || scope.unresolved
                            || (deep_tree && scope.relational)
                        {
                            record.unresolved = true;
                            continue;
                        }
                        let Ok(selectors) = SelectorList::parse(
                            &SelectorParser,
                            &mut Parser::new(&scope.text),
                            ParseRelative::No,
                        ) else {
                            record.unresolved = true;
                            continue;
                        };
                        for (side, tree) in
                            [(ReviewSide::Before, before), (ReviewSide::After, after)]
                        {
                            let Some(tree) = tree else {
                                continue;
                            };
                            let mut caches = SelectorCaches::default();
                            let mut context = MatchingContext::new(
                                MatchingMode::Normal,
                                None,
                                &mut caches,
                                QuirksMode::NoQuirks,
                                NeedsSelectorFlags::No,
                                MatchingForInvalidation::No,
                            );
                            for element in 0..tree.elements.len() {
                                if matches_selector_list(
                                    &selectors,
                                    &Cursor {
                                        tree,
                                        index: element,
                                    },
                                    &mut context,
                                ) && !record.elements.iter().any(|matched| {
                                    matched.side == side && matched.element == element
                                }) {
                                    record.elements.push(ElementMatch { side, element });
                                }
                            }
                        }
                    }
                }
                MatchedRule {
                    change: change.clone(),
                    selectors: order
                        .into_iter()
                        .filter_map(|selector| records.remove(&selector))
                        .collect(),
                }
            })
            .collect(),
    )
}

fn nesting(rule: &Rule, selector: &str) -> Option<String> {
    let mut parent = None;
    for condition in &rule.conditions {
        if condition.kind == ConditionKind::NestingParent {
            parent = Some(combine(&condition.prelude, parent.as_deref())?);
        }
    }
    combine(selector, parent.as_deref())
}
