//! Catalogue-wide own-page membership, nested filtering, and wire evidence.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::evidence::{EvidenceOwner, RuleEvidence, RuleStatus};
use mokly_model::review_affected::ReviewSide;
use mokly_model::review_order::rule_key;

use crate::containment::ContainmentPath;
use crate::match_tree::{Containment, MatchTree};
use crate::rule_matching::DocumentMatching;
use crate::{attribution_membership, observation};

/// Path-independent before and after tuples of one changed rule.
pub type RuleIdentity = (Option<(Vec<String>, String)>, Option<(Vec<String>, String)>);

/// Catalogue-wide proof before any nested-component filtering.
pub type OwnPageMatches = BTreeMap<RuleIdentity, BTreeSet<String>>;

/// Proof retained after the parsed document is released.
#[derive(Clone, Debug)]
pub struct MatchProof {
    /// Shared physical containment, visited innermost first.
    pub(crate) regions: ContainmentPath,
    /// Resolved input owner for the inline-style seam.
    pub owner: EvidenceOwner,
    /// Explicit sidecar owner, independent of copies on other documents.
    pub trusted_owner: Option<String>,
}

impl MatchProof {
    /// Visit allowed ancestry innermost first; head proof exposes supplier ancestry.
    pub fn regions(&self) -> impl Iterator<Item = &Containment> {
        self.regions.iter()
    }
}

/// One selector outcome, detached from its document arena.
#[derive(Clone, Debug)]
pub struct SelectorProof {
    /// Original selector.
    pub selector: String,
    /// Conservative keep outcome.
    pub unresolved: bool,
    /// Proven matches across both sides.
    pub matches: Vec<MatchProof>,
}

/// One changed rule and its stylesheet, before any per-page reduction.
#[derive(Clone, Debug)]
pub struct RuleObservation {
    /// Delivered public stylesheet route.
    pub stylesheet: String,
    /// Rule identity shared across bundles and paths.
    pub identity: RuleIdentity,
    /// Detached selector match proof.
    pub selectors: Vec<SelectorProof>,
}

/// All rule observations of one view, page, or document.
#[derive(Clone, Debug, Default)]
pub struct PageObservation {
    /// Parent component whose own page this is, absent on screens and pages.
    pub component: Option<String>,
    /// Ordered per-stylesheet changed rule facts.
    pub rules: Vec<RuleObservation>,
}

/// Complete own-page and per-entry attribution, with no parsed document retention.
#[derive(Clone, Debug)]
pub struct Attribution {
    /// Unfiltered own-page membership used by exact owned-instance proof.
    pub own_pages: OwnPageMatches,
    /// Wire evidence corresponding to each input page.
    pub pages: Vec<Vec<RuleEvidence>>,
    /// Component impact from unowned own-root matches; trusted owners need equal inputs.
    pub changed_components: BTreeSet<String>,
    /// Page indices with a kept own-root match, used for variant reasons.
    pub component_pages: BTreeSet<usize>,
}

/// Retain only containment proof before releasing each view's parsed trees.
pub fn observe(
    stylesheet: &str,
    matching: &DocumentMatching,
    before: Option<&MatchTree>,
    after: Option<&MatchTree>,
) -> Vec<RuleObservation> {
    observe_ancestry(stylesheet, matching, before, after, false)
}

pub(crate) fn observe_ancestry(
    stylesheet: &str,
    matching: &DocumentMatching,
    before: Option<&MatchTree>,
    after: Option<&MatchTree>,
    inputs: bool,
) -> Vec<RuleObservation> {
    match matching {
        DocumentMatching::Unresolved(_) => vec![RuleObservation {
            stylesheet: stylesheet.into(),
            identity: (None, None),
            selectors: vec![SelectorProof {
                selector: String::new(),
                unresolved: true,
                matches: Vec::new(),
            }],
        }],
        DocumentMatching::Resolved(rules) => rules
            .iter()
            .map(|rule| {
                let (left, right) = rule.change.identity();
                RuleObservation {
                    stylesheet: stylesheet.into(),
                    identity: (
                        left.map(|(selectors, declarations)| {
                            (selectors.to_vec(), declarations.into())
                        }),
                        right.map(|(selectors, declarations)| {
                            (selectors.to_vec(), declarations.into())
                        }),
                    ),
                    selectors: rule
                        .selectors
                        .iter()
                        .map(|selector| SelectorProof {
                            selector: selector.selector.clone(),
                            unresolved: selector.unresolved,
                            matches: selector
                                .elements
                                .iter()
                                .filter_map(|matched| {
                                    let tree = match matched.side {
                                        ReviewSide::Before => before,
                                        ReviewSide::After => after,
                                    }?;
                                    let element = tree.elements.get(matched.element)?;
                                    Some(MatchProof {
                                        regions: if inputs {
                                            element.input_regions.clone()
                                        } else {
                                            element.regions.clone()
                                        },
                                        owner: element.owner.clone(),
                                        trusted_owner: None,
                                    })
                                })
                                .collect(),
                        })
                        .collect(),
                }
            })
            .collect(),
    }
}

/// Resolve all own-page matches before attributing any entry's records.
pub fn attribute(observations: &[PageObservation]) -> Attribution {
    let pages: Vec<_> = observations
        .iter()
        .map(|page| PageObservation {
            component: page.component.clone(),
            rules: observation::merge(page.rules.clone()),
        })
        .collect();
    let mut unfiltered = OwnPageMatches::new();
    for page in &pages {
        let Some(component) = &page.component else {
            continue;
        };
        for rule in &page.rules {
            if rule
                .selectors
                .iter()
                .filter(|selector| !selector.unresolved)
                .flat_map(|selector| &selector.matches)
                .any(|matched| attribution_membership::own_root(matched, component))
            {
                unfiltered
                    .entry(rule.identity.clone())
                    .or_default()
                    .insert(component.clone());
            }
        }
    }
    let mut changed: BTreeMap<RuleIdentity, BTreeSet<String>> = BTreeMap::new();
    let mut changed_components = BTreeSet::new();
    let mut component_pages = BTreeSet::new();
    for (index, page) in pages.iter().enumerate() {
        let Some(component) = &page.component else {
            continue;
        };
        for rule in &page.rules {
            let unfiltered = unfiltered.get(&rule.identity);
            let kept = rule
                .selectors
                .iter()
                .filter(|selector| !selector.unresolved)
                .flat_map(|selector| &selector.matches)
                .any(|matched| {
                    attribution_membership::own_root(matched, component)
                        && attribution_membership::kept(matched, component, unfiltered)
                });
            if kept {
                if rule
                    .selectors
                    .iter()
                    .filter(|selector| !selector.unresolved)
                    .flat_map(|selector| &selector.matches)
                    .any(|matched| {
                        matched.trusted_owner.is_none()
                            && attribution_membership::own_root(matched, component)
                            && attribution_membership::kept(matched, component, unfiltered)
                    })
                {
                    changed_components.insert(component.clone());
                }
                changed
                    .entry(rule.identity.clone())
                    .or_default()
                    .insert(component.clone());
                component_pages.insert(index);
            }
        }
    }
    let output = pages
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
        .collect();
    Attribution {
        own_pages: unfiltered,
        pages: output,
        changed_components,
        component_pages,
    }
}
