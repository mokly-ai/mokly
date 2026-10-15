//! Complete workspace lists derived only from settled current usage.

use std::collections::BTreeMap;

use crate::axes::EntryKind;
use crate::public_detail::{EntryDetailV1, UsageLink, VisualKind, Workspace};
use crate::public_index::CatalogueReadModel;
use crate::usage::{CatalogueUsage, ComponentInputOwner};

/// Omit unproven lists; install complete consumers once all visual usage is ready.
pub fn workspaces(details: &mut BTreeMap<String, EntryDetailV1>, index: &CatalogueReadModel) {
    let ready = details
        .values()
        .flat_map(|detail| &detail.views)
        .all(|view| matches!(view.usage, CatalogueUsage::Ready { .. }));
    for detail in details.values_mut() {
        detail.workspace = None;
    }
    if !ready {
        return;
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
        let root_component = parents.get(path.as_str()).copied();
        for view in &detail.views {
            let CatalogueUsage::Ready { instances, .. } = &view.usage else {
                continue;
            };
            let root = instances.iter().find(|instance| {
                root_component == Some(instance.component_id.as_str())
                    && matches!(instance.owner, ComponentInputOwner::Entry)
            });
            for instance in instances {
                if root.is_some_and(|root| root.key == instance.key) {
                    continue;
                }
                let direct = match &instance.owner {
                    ComponentInputOwner::Entry => true,
                    ComponentInputOwner::Instance { instance_key } => {
                        root.is_some_and(|root| &root.key == instance_key)
                    }
                };
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
    for (path, detail) in details.iter_mut() {
        if matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component) {
            detail.workspace = Some(Workspace {
                comparison_eligible: false,
                used_by: lists.get(path).cloned().unwrap_or_default(),
                affected: Vec::new(),
                related_components: Vec::new(),
                input_changes: Vec::new(),
            });
        }
    }
}
