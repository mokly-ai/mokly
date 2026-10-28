//! Complete workspace lists derived only from settled current usage.

use std::collections::{BTreeMap, BTreeSet};

use crate::axes::EntryKind;
use crate::public_detail::{EntryDetailV3, UsageLink, VisualKind, Workspace};
use crate::public_index::CatalogueReadModel;
use crate::usage::{CatalogueUsage, ComponentInputOwner};

/// Omit unproven lists; install complete consumers once all visual usage is ready.
pub fn workspaces(
    details: &BTreeMap<String, &EntryDetailV3>,
    index: &CatalogueReadModel,
) -> BTreeMap<String, Workspace> {
    let ready = details
        .values()
        .flat_map(|detail| &detail.views)
        .all(|view| matches!(view.usage, CatalogueUsage::Ready { .. }));
    if !ready {
        return BTreeMap::new();
    }
    let variants: BTreeSet<&str> = index
        .components
        .iter()
        .filter_map(|component| {
            component
                .variant_of
                .as_ref()
                .map(|_| component.entry.path.as_str())
        })
        .collect();
    let titles: BTreeMap<_, _> = index
        .screens
        .iter()
        .map(|entry| (&entry.entry.path, &entry.entry.title))
        .chain(
            index
                .components
                .iter()
                .map(|entry| (&entry.entry.path, &entry.entry.title)),
        )
        .collect();
    let mut consumers: BTreeMap<&str, Vec<UsageLink>> = BTreeMap::new();
    for (path, detail) in details.iter() {
        let Some(title) = titles.get(path) else {
            continue;
        };
        for view in &detail.views {
            let CatalogueUsage::Ready { instances, .. } = &view.usage else {
                continue;
            };
            for instance in instances {
                let direct = matches!(instance.owner, ComponentInputOwner::Entry);
                consumers
                    .entry(&instance.component_id)
                    .or_default()
                    .push(UsageLink {
                        entry_path: path.clone(),
                        entry_kind: if detail.entry.kind == EntryKind::Screen {
                            VisualKind::Screen
                        } else {
                            VisualKind::Component
                        },
                        title: (*title).clone(),
                        viewport: view.viewport,
                        color_scheme: view.color_scheme,
                        instance_key: instance.key.clone(),
                        direct,
                        removed: false,
                        comparison_eligible: false,
                    });
            }
        }
    }
    let mut lists: BTreeMap<&str, Vec<UsageLink>> = index
        .components
        .iter()
        .filter(|component| component.variant_of.is_none())
        .map(|component| {
            let path = component.entry.path.as_str();
            (path, consumers.remove(path).unwrap_or_default())
        })
        .collect();
    let mut workspaces = BTreeMap::new();
    for (path, detail) in details {
        if matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component) {
            let component_parent =
                detail.entry.kind == EntryKind::Component && !variants.contains(path.as_str());
            workspaces.insert(
                path.clone(),
                Workspace {
                    comparison_eligible: false,
                    used_by: (!variants.contains(path.as_str())).then(|| {
                        if component_parent {
                            lists.remove(path.as_str()).unwrap_or_default()
                        } else {
                            Vec::new()
                        }
                    }),
                    affected: (!variants.contains(path.as_str())).then(Vec::new),
                    related_components: Vec::new(),
                    input_changes: Vec::new(),
                },
            );
        }
    }
    workspaces
}

#[cfg(test)]
#[path = "_tests_/projection_usage_tests.rs"]
mod projection_usage_tests;
