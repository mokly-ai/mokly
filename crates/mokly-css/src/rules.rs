//! Ordered unoptimized CSS rules and occurrence-preserving diffs.

use std::collections::{BTreeMap, VecDeque};

use mokly_model::review_affected::ReviewSide;
use serde::{Deserialize, Serialize};

/// Unevaluated condition kinds retained in authored nesting order.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConditionKind {
    /// Media query.
    Media,
    /// Container query.
    Container,
    /// Feature query.
    Supports,
    /// Cascade layer.
    Layer,
    /// Enclosing selector list.
    NestingParent,
}

impl ConditionKind {
    /// Stable protocol spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Media => "media",
            Self::Container => "container",
            Self::Supports => "supports",
            Self::Layer => "layer",
            Self::NestingParent => "nesting-parent",
        }
    }
}

/// Ordered enclosing condition, including authored nesting parents.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize)]
pub struct Condition {
    /// At-rule name without the at-keyword, or nesting-parent.
    pub kind: ConditionKind,
    /// Normalized condition or complete nesting selector list.
    pub prelude: String,
}

/// An opaque selector-less rule.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize)]
pub struct AtRule {
    /// At-rule name without @.
    pub name: String,
    /// Normalized prelude.
    pub prelude: String,
}

/// One declaration run before optimization.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize)]
pub struct Rule {
    /// Zero-based depth-first ordinal.
    pub ordinal: usize,
    /// Serialized selectors in authored order.
    pub selectors: Vec<String>,
    /// Normalized tokens, retaining duplicates and declaration order.
    pub declarations: String,
    /// Ordered enclosing conditions.
    pub conditions: Vec<Condition>,
    /// Present on a selector-less rule.
    pub at_rule: Option<AtRule>,
    /// Complete normalized custom declarations, used by the keep rule.
    pub custom: Vec<String>,
    /// URL and import identities, used by the changed-reference keep rule.
    pub references: Vec<String>,
}

/// Parsed CSS or an entire-sheet failure with no partial rules.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum ParsedCss {
    /// Complete valid rule collection.
    Rules(Vec<Rule>),
    /// Invalid syntax, encoding, or serialization.
    Failed(String),
}

/// Borrowed path-independent tuples for cross-stylesheet rule joining.
pub type BorrowedRuleIdentity<'a> = (
    Option<(&'a [String], &'a str)>,
    Option<(&'a [String], &'a str)>,
);

/// One changed, added, or removed rule occurrence.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RuleChange {
    /// Original occurrence on the base side.
    pub before: Option<Rule>,
    /// Original occurrence on the current side.
    pub after: Option<Rule>,
}

impl RuleChange {
    /// Cross-stylesheet identity excludes conditions, paths, and ordinals.
    pub fn identity(&self) -> BorrowedRuleIdentity<'_> {
        (
            self.before
                .as_ref()
                .map(|rule| (rule.selectors.as_slice(), rule.declarations.as_str())),
            self.after
                .as_ref()
                .map(|rule| (rule.selectors.as_slice(), rule.declarations.as_str())),
        )
    }

    /// Keep custom-property changes and changed URL references conservatively.
    pub fn conservative(&self) -> bool {
        let custom_before = self
            .before
            .as_ref()
            .map_or(&[][..], |rule| rule.custom.as_slice());
        let custom_after = self
            .after
            .as_ref()
            .map_or(&[][..], |rule| rule.custom.as_slice());
        let urls_before = self
            .before
            .as_ref()
            .map_or(&[][..], |rule| rule.references.as_slice());
        let urls_after = self
            .after
            .as_ref()
            .map_or(&[][..], |rule| rule.references.as_slice());
        custom_before != custom_after || urls_before != urls_after
    }
}

/// Side-tagged whole-sheet parse failure.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RuleFailure {
    /// before or after.
    pub side: ReviewSide,
    /// Stable failure outcome.
    pub code: String,
    /// Parser or serializer cause.
    pub cause: String,
}

/// Multiset diff. A failure never returns partial lists.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum RuleDiff {
    /// Ordered additions, removals, and declaration edits.
    Resolved {
        /// After ordinal order.
        added: Vec<RuleChange>,
        /// Before ordinal order.
        removed: Vec<RuleChange>,
        /// After ordinal order.
        changed: Vec<RuleChange>,
    },
    /// Both sides' failures in before/after order.
    Unresolved(Vec<RuleFailure>),
}

/// Cancel equal occurrences first, then pair equal selector and condition keys.
pub fn diff(before: &ParsedCss, after: &ParsedCss) -> RuleDiff {
    let mut failures = Vec::new();
    for (side, parsed) in [(ReviewSide::Before, before), (ReviewSide::After, after)] {
        if let ParsedCss::Failed(cause) = parsed {
            failures.push(RuleFailure {
                side,
                code: "css-parse-failed".into(),
                cause: cause.clone(),
            });
        }
    }
    if !failures.is_empty() {
        return RuleDiff::Unresolved(failures);
    }
    let (ParsedCss::Rules(before), ParsedCss::Rules(after)) = (before, after) else {
        return RuleDiff::Unresolved(failures);
    };
    let mut exact: BTreeMap<_, VecDeque<usize>> = BTreeMap::new();
    for (index, rule) in before.iter().enumerate() {
        exact
            .entry((key(rule), rule.declarations.as_str()))
            .or_default()
            .push_back(index);
    }
    let mut used_before = vec![false; before.len()];
    let mut used_after = vec![false; after.len()];
    for (index, rule) in after.iter().enumerate() {
        if let Some(previous) = exact
            .get_mut(&(key(rule), rule.declarations.as_str()))
            .and_then(VecDeque::pop_front)
        {
            used_before[previous] = true;
            used_after[index] = true;
        }
    }
    let mut remaining: BTreeMap<_, VecDeque<usize>> = BTreeMap::new();
    for (index, rule) in before
        .iter()
        .enumerate()
        .filter(|(index, _)| !used_before[*index])
    {
        remaining.entry(key(rule)).or_default().push_back(index);
    }
    let mut changed = Vec::new();
    let mut added = Vec::new();
    for (_index, rule) in after
        .iter()
        .enumerate()
        .filter(|(index, _)| !used_after[*index])
    {
        if let Some(previous) = remaining.get_mut(&key(rule)).and_then(VecDeque::pop_front) {
            used_before[previous] = true;
            changed.push(RuleChange {
                before: Some(before[previous].clone()),
                after: Some(rule.clone()),
            });
        } else {
            added.push(RuleChange {
                before: None,
                after: Some(rule.clone()),
            });
        }
    }
    let removed = before
        .iter()
        .enumerate()
        .filter(|(i, _)| !used_before[*i])
        .map(|(_, rule)| RuleChange {
            before: Some(rule.clone()),
            after: None,
        })
        .collect();
    RuleDiff::Resolved {
        added,
        removed,
        changed,
    }
}

fn key(rule: &Rule) -> (&[Condition], &[String], &Option<AtRule>) {
    (&rule.conditions, &rule.selectors, &rule.at_rule)
}
