//! Recorded usage keys, schemas, source locations, and input-scope ordering.

use std::collections::{BTreeMap, BTreeSet};

use crate::axes::EntryKind;
use crate::detail_context::invalid;
use crate::material;
use crate::paths::is_path_segment;
use crate::public_records::CatalogueComponent;
use crate::public_validation::hash;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;
use crate::usage::{CatalogueUsage, ComponentInputOwner};
use crate::usage_schemas::UsageSchemas;
use crate::{usage_references, wire_decode};

/// Validate usage against the component parents of the same source side.
/// The caller supplies the base catalogue for a historical detail.
pub fn validate(
    usage: &CatalogueUsage,
    kind: EntryKind,
    components: &[CatalogueComponent],
) -> Result<(), ReadError> {
    validate_with(usage, kind, &mut UsageSchemas::new(components))
}

/// Reuse component validators across every detail in one publication.
pub fn validate_with(
    usage: &CatalogueUsage,
    kind: EntryKind,
    schemas: &mut UsageSchemas<'_>,
) -> Result<(), ReadError> {
    let CatalogueUsage::Ready {
        instances,
        slots,
        ranges,
    } = usage
    else {
        return Ok(());
    };
    let mut previous = None;
    let mut orders: BTreeMap<(Option<&str>, Option<&str>), BTreeSet<u64>> = BTreeMap::new();
    for instance in instances {
        if !hash(&instance.key)
            || previous.is_some_and(|previous: &str| previous >= instance.key.as_str())
        {
            return Err(invalid(ContractViolation::UsageOrder));
        }
        previous = Some(instance.key.as_str());
        let component = schemas
            .component(&instance.component_id)
            .ok_or_else(|| invalid(ContractViolation::UsageReference))?;
        let default_id = component.entry.path.rsplit('/').next().unwrap_or("");
        if !is_path_segment(&instance.id)
            || instance.id != default_id
                && !instance.id.split('-').all(|part| {
                    !part.is_empty()
                        && part
                            .bytes()
                            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
                })
        {
            return Err(invalid(ContractViolation::UsageKey));
        }
        if material::instance_key(&instance.owner, instance.slot_key.as_deref(), &instance.id)
            .ok()
            .as_deref()
            != Some(&instance.key)
        {
            return Err(invalid(ContractViolation::UsageKey));
        }
        let props = match wire_decode::decode(&instance.props) {
            Ok(props) => props,
            Err(_) => return Err(invalid(ContractViolation::UsageProps)),
        };
        if material::props_key(&props).ok().as_deref() != Some(&instance.props_key) {
            return Err(invalid(ContractViolation::UsageKey));
        }
        schemas.validate(&instance.component_id, &props)?;
        if instance.source.as_ref().is_some_and(|source| {
            !safe_path(&source.path)
                || source.line == 0
                || source.column == 0
                || source.line > 9_007_199_254_740_991
                || source.column > 9_007_199_254_740_991
        }) {
            return Err(invalid(ContractViolation::UsageSource));
        }
        let owner = match &instance.owner {
            ComponentInputOwner::Entry => None,
            ComponentInputOwner::Instance { instance_key } => Some(instance_key.as_str()),
        };
        if !orders
            .entry((owner, instance.slot_key.as_deref()))
            .or_default()
            .insert(instance.order)
        {
            return Err(invalid(ContractViolation::UsageOrder));
        }
    }
    for order in orders.values() {
        if order.iter().copied().ne(0..order.len() as u64) {
            return Err(invalid(ContractViolation::UsageOrder));
        }
    }
    let mut previous = None;
    for slot in slots {
        if !hash(&slot.key)
            || previous.is_some_and(|previous: &str| previous >= slot.key.as_str())
            || material::slot_key(&slot.instance_key, &slot.name)
                .ok()
                .as_deref()
                != Some(&slot.key)
        {
            return Err(invalid(ContractViolation::UsageKey));
        }
        previous = Some(slot.key.as_str());
    }
    usage_references::validate(instances, slots, ranges, kind, schemas.components)
}

fn safe_path(path: &str) -> bool {
    !path.is_empty()
        && !path.starts_with('/')
        && !path.contains(['\\', ':', '\0'])
        && !path.split('/').any(|part| matches!(part, "" | "." | ".."))
}

#[cfg(test)]
#[path = "_tests_/usage_context_tests.rs"]
mod usage_context_tests;
