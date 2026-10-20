//! Complete workspace lists derived only from settled current usage.

use std::collections::BTreeMap;

use crate::axes::EntryKind;
use crate::public_detail::{EntryDetailV2, UsageLink, VisualKind, Workspace};
use crate::public_index::CatalogueReadModel;
use crate::usage::{CatalogueUsage, ComponentInputOwner};

/// Omit unproven lists; install complete consumers once all visual usage is ready.
pub fn workspaces(
    details: &BTreeMap<String, &EntryDetailV2>,
    index: &CatalogueReadModel,
) -> BTreeMap<String, Workspace> {
    let ready = details
        .values()
        .flat_map(|detail| &detail.views)
        .all(|view| matches!(view.usage, CatalogueUsage::Ready { .. }));
    if !ready {
        return BTreeMap::new();
    }
    let parents: BTreeMap<_, _> = index
        .components
        .iter()
        .map(|component| {
            (
                component.entry.path.as_str(),
                component
                    .variant_of
                    .as_deref()
                    .unwrap_or(&component.entry.path),
            )
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
    let lists: BTreeMap<String, Vec<UsageLink>> = parents
        .into_iter()
        .map(|(path, parent)| {
            (
                path.to_owned(),
                consumers.get(parent).cloned().unwrap_or_default(),
            )
        })
        .collect();
    let mut workspaces = BTreeMap::new();
    for (path, detail) in details {
        if matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component) {
            workspaces.insert(
                path.clone(),
                Workspace {
                    comparison_eligible: false,
                    used_by: lists.get(path).cloned().unwrap_or_default(),
                    affected: Vec::new(),
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
