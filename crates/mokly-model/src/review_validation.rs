//! Strict structural review validation. The classifier separately proves source coverage.

use std::collections::{BTreeMap, BTreeSet};

use crate::canonical;
use crate::evidence::{EvidenceOwner, RuleStatus};
use crate::paths::is_entry_path;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;
use crate::review::{EntryChangeReason, ReviewEntry, ReviewKind, ReviewResultV8, ReviewState};
use crate::wire_decode;
use crate::{review_affected_validation, review_order};

/// Validate ordering, identities, explicit sides, and evidence references without reordering.
pub fn validate(result: &ReviewResultV8) -> Result<(), ReadError> {
    let failure = || ReadError::Contract {
        boundary: "review result",
        message: ContractViolation::Review,
    };
    if !commit(&result.base_commit) {
        return Err(failure());
    }
    let mut sorted = result.clone();
    if review_order::normalize(&mut sorted).is_err() {
        return Err(failure());
    }
    if canonical::to_string(result).ok() != canonical::to_string(&sorted).ok() {
        return Err(failure());
    }
    let mut entries = Vec::new();
    for entry in &result.entries {
        entries.push(entry);
        if let Some(variants) = &entry.variants {
            if entry.kind != ReviewKind::Component
                || variants.iter().any(|variant| {
                    variant.kind != ReviewKind::Component || variant.variants.is_some()
                })
            {
                return Err(failure());
            }
            entries.extend(variants);
        }
    }
    let owners: BTreeMap<_, _> = result
        .entries
        .iter()
        .flat_map(|entry| {
            entry
                .variants
                .iter()
                .flatten()
                .map(|variant| (variant.path.as_str(), entry.path.as_str()))
        })
        .collect();
    let mut keys = BTreeSet::new();
    let mut historical = BTreeSet::new();
    for entry in &entries {
        if !keys.insert(entry.path.to_ascii_lowercase())
            || !valid_entry(
                entry,
                owners
                    .get(entry.path.as_str())
                    .copied()
                    .unwrap_or(&entry.path),
            )
        {
            return Err(failure());
        }
        if let Some(before) = &entry.before
            && !historical.insert((entry.kind, before.path.to_ascii_lowercase()))
        {
            return Err(failure());
        }
    }
    let mut affected_keys = BTreeSet::new();
    for affected in &result.affected {
        if !review_affected_validation::valid(affected, &entries)
            || affected.evidence.is_empty()
            || !is_entry_path(&affected.consumer.path)
            || !affected_keys.insert(review_order::affected_key(affected))
            || !entries.iter().any(|entry| {
                entry.kind == ReviewKind::Component
                    && entry.path == affected.changed_component_id
                    && entry.included
            })
        {
            return Err(failure());
        }
        for evidence in &affected.evidence {
            if evidence.via.is_empty()
                || !is_entry_path(&evidence.context.entry.path)
                || evidence
                    .via
                    .iter()
                    .any(|edge| !is_entry_path(&edge.component_id) || !digest(&edge.instance_key))
            {
                return Err(failure());
            }
        }
    }
    Ok(())
}

fn valid_entry(entry: &ReviewEntry, component_owner: &str) -> bool {
    let Some(address) = entry.after.as_ref().or(entry.before.as_ref()) else {
        return false;
    };
    if !is_entry_path(&entry.path)
        || entry.path != address.path
        || entry.title != address.title
        || entry.title.trim().is_empty()
    {
        return false;
    }
    for address in entry.before.iter().chain(&entry.after) {
        if !is_entry_path(&address.path) || address.title.trim().is_empty() {
            return false;
        }
        if (entry.kind == ReviewKind::UseCase) != address.props.is_none()
            || (entry.kind == ReviewKind::Component) != address.supplied_slots.is_some()
            || address
                .props
                .as_ref()
                .is_some_and(|props| wire_decode::decode(props).is_err())
        {
            return false;
        }
    }
    if entry.included != (!entry.reasons.is_empty() || entry.previous_path.is_some()) {
        return false;
    }
    if let Some(previous) = &entry.previous_path
        && (entry
            .before
            .as_ref()
            .is_none_or(|before| &before.path != previous)
            || entry.after.is_none()
            || previous.eq_ignore_ascii_case(&entry.path))
    {
        return false;
    }
    if (entry.before.is_none() && entry.state != ReviewState::Added)
        || (entry.after.is_none() && entry.state != ReviewState::Removed)
    {
        return false;
    }
    if entry.kind == ReviewKind::UseCase && (!entry.views.is_empty() || entry.variants.is_some()) {
        return false;
    }
    if entry.kind != ReviewKind::UseCase && entry.views.is_empty() {
        return false;
    }
    for reason in &entry.reasons {
        match reason {
            EntryChangeReason::Added if entry.before.is_some() => return false,
            EntryChangeReason::Removed if entry.after.is_some() => return false,
            EntryChangeReason::Screen { screen_path }
                if entry.kind != ReviewKind::UseCase || !is_entry_path(screen_path) =>
            {
                return false;
            }
            EntryChangeReason::Dependency { path }
                if !entry.views.iter().any(|view| {
                    view.rules.iter().any(|rule| {
                        &rule.stylesheet == path
                            && rule.status != RuleStatus::Excluded
                            && owned(&rule.owner, component_owner)
                    }) || view.resources.iter().any(|resource| {
                        &resource.path == path && owned(&resource.owner, component_owner)
                    })
                }) =>
            {
                return false;
            }
            _ => {}
        }
    }
    let mut views = BTreeSet::new();
    for view in &entry.views {
        if !views.insert((view.viewport, view.color_scheme))
            || view.ignored_ids.iter().any(|id| !ignore_id(id))
        {
            return false;
        }
        if view.state == ReviewState::Added && entry.after.is_none()
            || view.state == ReviewState::Removed && entry.before.is_none()
        {
            return false;
        }
        let mut rules = BTreeSet::new();
        for rule in &view.rules {
            if !resource_path(&rule.stylesheet) || !rules.insert(review_order::rule_key(rule)) {
                return false;
            }
            if rule.status == RuleStatus::Unresolved && rule.owner != EvidenceOwner::Entry {
                return false;
            }
            if rule.status == RuleStatus::Excluded
                && (!rule.selector.is_empty()
                    || rule.owner != EvidenceOwner::Entry
                    || view.rules.iter().any(|other| {
                        other.stylesheet == rule.stylesheet && other.status != RuleStatus::Excluded
                    }))
            {
                return false;
            }
            if matches!(
                view.state,
                ReviewState::Unchanged | ReviewState::IgnoredOnly
            ) && rule.status != RuleStatus::Excluded
                && rule.owner == EvidenceOwner::Entry
            {
                return false;
            }
        }
        if view
            .resources
            .iter()
            .any(|resource| !resource_path(&resource.path))
        {
            return false;
        }
    }
    true
}

fn owned(owner: &EvidenceOwner, path: &str) -> bool {
    owner == &EvidenceOwner::Entry
        || matches!(owner, EvidenceOwner::Component { path: component } if component == path)
}
fn digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
fn commit(value: &str) -> bool {
    matches!(value.len(), 40 | 64) && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}
fn ignore_id(value: &str) -> bool {
    !value.is_empty()
        && value.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        })
}
fn resource_path(value: &str) -> bool {
    value.starts_with("static/")
        && value
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
        && !value.contains(['\\', '\0', '?', '#'])
}
