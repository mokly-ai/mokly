//! Actual input-ownership chains produce direct, transitive, and historical consumers.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::catalogue::{CatalogueModel, EntryContent};
use mokly_model::review_affected::{
    AffectedConsumer, AffectedConsumerAddress, AffectedInstance, AffectedUsageEvidence,
    ComponentUsageContext, ConsumerKind, ReviewSide,
};
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};

use crate::comparison_views::UsageView;
use crate::material::mapped;
use crate::move_types::Pairing;

pub(crate) fn collect(
    usage: &[UsageView],
    impact: &BTreeSet<String>,
    pairing: &Pairing,
    before: &CatalogueModel,
    after: &CatalogueModel,
) -> (Vec<AffectedConsumer>, usize) {
    let paths = pairing.paths(before, after);
    let mut lookups = 0;
    let before_contexts: BTreeMap<_, _> = before
        .entries
        .iter()
        .map(|entry| (entry.metadata.path.as_str(), entry))
        .collect();
    let after_contexts: BTreeMap<_, _> = after
        .entries
        .iter()
        .map(|entry| (entry.metadata.path.as_str(), entry))
        .collect();
    let mut destinations = BTreeMap::new();
    for pair in &pairing.entries {
        for (side, model, index) in [
            (ReviewSide::Before, before, pair.before),
            (ReviewSide::After, after, pair.after),
        ] {
            let Some(entry) = index.and_then(|index| model.entries.get(index)) else {
                continue;
            };
            let kind = match entry.content {
                EntryContent::Screen { .. } => ConsumerKind::Screen,
                EntryContent::Component { .. } => ConsumerKind::Component,
                _ => continue,
            };
            let destination = pair.after.map_or(entry, |index| &after.entries[index]);
            destinations.insert(
                (side, kind, entry.metadata.path.to_ascii_lowercase()),
                destination.metadata.path.clone(),
            );
        }
    }
    let mut records: BTreeMap<(String, ConsumerKind, String), Vec<AffectedUsageEvidence>> =
        BTreeMap::new();
    for view in usage {
        let CatalogueUsage::Ready { instances, .. } = &view.usage else {
            continue;
        };
        let Some(viewport) = view.key.viewport else {
            continue;
        };
        let index: BTreeMap<_, _> = instances
            .iter()
            .map(|instance| (instance.key.as_str(), instance))
            .collect();
        let contexts = if view.side == ReviewSide::Before {
            &before_contexts
        } else {
            &after_contexts
        };
        lookups += 1;
        let context_entry = contexts.get(view.entry.path.as_str());
        let component_path = context_entry
            .and_then(|entry| entry.metadata.variant_of.as_ref())
            .unwrap_or(&view.entry.path);
        for instance in instances {
            let changed = if view.side == ReviewSide::Before {
                mapped(&instance.component_id, &paths)
            } else {
                instance.component_id.clone()
            };
            if !impact.contains(&changed) {
                continue;
            }
            let mut chain = vec![instance];
            let mut next = &instance.owner;
            let mut visited = BTreeSet::from([instance.key.as_str()]);
            while let ComponentInputOwner::Instance { instance_key } = next {
                let Some(parent) = index.get(instance_key.as_str()) else {
                    break;
                };
                if !visited.insert(parent.key.as_str()) {
                    break;
                }
                chain.push(parent);
                next = &parent.owner;
            }
            if !matches!(next, ComponentInputOwner::Entry) {
                continue;
            }
            chain.reverse();
            let context_kind = if view.component {
                ConsumerKind::Component
            } else {
                ConsumerKind::Screen
            };
            let owner_path = if view.component {
                component_path
            } else {
                &view.entry.path
            };
            let mut consumers = vec![(context_kind, owner_path.as_str(), 0)];
            for (position, ancestor) in chain.iter().enumerate().take(chain.len().saturating_sub(1))
            {
                consumers.push((
                    ConsumerKind::Component,
                    ancestor.component_id.as_str(),
                    position + 1,
                ));
            }
            for (kind, path, start) in consumers {
                lookups += 1;
                let Some(path) = destinations
                    .get(&(view.side, kind, path.to_ascii_lowercase()))
                    .cloned()
                else {
                    continue;
                };
                if path == changed && kind == ConsumerKind::Component {
                    continue;
                }
                let evidence = AffectedUsageEvidence {
                    side: view.side,
                    context: ComponentUsageContext {
                        kind: context_kind,
                        entry: view.entry.clone(),
                        viewport,
                        color_scheme: view.key.color_scheme,
                    },
                    via: chain[start..]
                        .iter()
                        .map(|instance| AffectedInstance {
                            component_id: instance.component_id.clone(),
                            instance_key: instance.key.clone(),
                        })
                        .collect(),
                };
                records
                    .entry((changed.clone(), kind, path))
                    .or_default()
                    .push(evidence);
            }
        }
    }
    let records = records
        .into_iter()
        .map(
            |((changed_component_id, kind, path), evidence)| AffectedConsumer {
                changed_component_id,
                consumer: AffectedConsumerAddress { kind, path },
                evidence,
            },
        )
        .collect();
    (records, lookups)
}
