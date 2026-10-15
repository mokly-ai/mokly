//! Canonical comparison order shared by producers and strict readers.

use crate::axes::{ColorScheme, Viewport};
use crate::canonical::{compare_utf16, to_string};
use crate::error::Result;
use crate::evidence::{EvidenceOwner, ResourceEvidence, RuleEvidence, RuleStatus};
use crate::review::{EntryChangeReason, ReviewEntry, ReviewResultV8};
use crate::review_affected::{AffectedConsumer, AffectedUsageEvidence, ConsumerKind, ReviewSide};

/// Normalize a producer result. Readers compare the supplied order instead.
pub fn normalize(result: &mut ReviewResultV8) -> Result<()> {
    result
        .entries
        .sort_by(|left, right| (left.kind, &left.path).cmp(&(right.kind, &right.path)));
    for entry in &mut result.entries {
        entry_order(entry);
    }
    result.affected.sort_by_key(affected_key);
    for affected in &mut result.affected {
        let mut keyed = Vec::new();
        for evidence in std::mem::take(&mut affected.evidence) {
            keyed.push((usage_key(&evidence)?, evidence));
        }
        keyed.sort_by(|left, right| left.0.cmp(&right.0));
        keyed.dedup_by(|left, right| left.0 == right.0);
        affected.evidence = keyed.into_iter().map(|(_, evidence)| evidence).collect();
    }
    Ok(())
}

fn entry_order(entry: &mut ReviewEntry) {
    entry
        .views
        .sort_by_key(|view| (view.viewport, view.color_scheme));
    entry
        .reasons
        .sort_by(|left, right| reason_key(left).cmp(&reason_key(right)));
    entry.reasons.dedup();
    for view in &mut entry.views {
        view.ignored_ids
            .sort_by(|left, right| compare_utf16(left, right));
        view.ignored_ids.dedup();
        view.rules.sort_by_key(rule_key);
        view.rules.dedup();
        view.resources.sort_by_key(resource_key);
        view.resources.dedup();
    }
    for variant in entry.variants.iter_mut().flatten() {
        entry_order(variant);
    }
}

/// Lexical reason kind followed by its explicit target.
pub fn reason_key(reason: &EntryChangeReason) -> (&str, &str) {
    match reason {
        EntryChangeReason::Added => ("added", ""),
        EntryChangeReason::Removed => ("removed", ""),
        EntryChangeReason::Metadata => ("metadata", ""),
        EntryChangeReason::Material => ("material", ""),
        EntryChangeReason::Inputs => ("inputs", ""),
        EntryChangeReason::Structure => ("structure", ""),
        EntryChangeReason::Dependency { path } => ("dependency", path),
        EntryChangeReason::Screen { screen_path } => ("screen", screen_path),
    }
}

/// Public rule evidence ordering, using UTF-16 string keys.
pub fn rule_key(rule: &RuleEvidence) -> (Vec<u16>, Vec<u16>, &'static str, &'static str, Vec<u16>) {
    let (kind, path) = owner_key(&rule.owner);
    (
        utf16(&rule.stylesheet),
        utf16(&rule.selector),
        match rule.status {
            RuleStatus::Matched => "matched",
            RuleStatus::Excluded => "excluded",
            RuleStatus::Unresolved => "unresolved",
        },
        kind,
        utf16(path),
    )
}

/// Public resource evidence ordering.
pub fn resource_key(resource: &ResourceEvidence) -> (Vec<u16>, &'static str, Vec<u16>) {
    let (kind, path) = owner_key(&resource.owner);
    (utf16(&resource.path), kind, utf16(path))
}

/// Canonical consumer ordering shared with the evidence builder.
pub fn affected_key(affected: &AffectedConsumer) -> (Vec<u16>, ConsumerKind, Vec<u16>) {
    (
        utf16(&affected.changed_component_id),
        affected.consumer.kind,
        utf16(&affected.consumer.path),
    )
}

/// Canonical side, context, view, and ownership-chain order.
pub type UsageOrderKey = (
    ReviewSide,
    ConsumerKind,
    Vec<u16>,
    Viewport,
    ColorScheme,
    Vec<u16>,
);

/// Canonical usage order includes the complete ordered ownership chain.
pub fn usage_key(evidence: &AffectedUsageEvidence) -> Result<UsageOrderKey> {
    Ok((
        evidence.side,
        evidence.context.kind,
        utf16(&evidence.context.entry.path),
        evidence.context.viewport,
        evidence.context.color_scheme,
        utf16(&to_string(&evidence.via)?),
    ))
}

fn utf16(value: &str) -> Vec<u16> {
    value.encode_utf16().collect()
}

fn owner_key(owner: &EvidenceOwner) -> (&'static str, &str) {
    match owner {
        EvidenceOwner::Entry => ("entry", ""),
        EvidenceOwner::Component { path } => ("component", path),
    }
}
