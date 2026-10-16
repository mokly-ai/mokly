//! Complete workspace lists join current usage with retained before-side evidence.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::axes::EntryKind;
use mokly_model::public_detail::{
    EntryDetailV1, InputChange, RelatedComponent, UsageLink, VisualKind, Workspace,
};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::review_affected::{ConsumerKind, ReviewSide};
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};

use crate::comparison_files::graph;
use crate::comparison_index::eligible;
use crate::error::Result;

pub(crate) fn apply(
    details: &mut BTreeMap<String, EntryDetailV1>,
    index: &CatalogueReadModel,
    result: &ComparisonResult,
) -> Result<()> {
    let current = &result.after.catalogue().model;
    let before = &result.before.catalogue().model;
    let titles: BTreeMap<_, _> = before
        .entries
        .iter()
        .chain(&current.entries)
        .map(|entry| (entry.metadata.path.as_str(), entry.metadata.title.as_str()))
        .collect();
    let classifications: BTreeMap<_, _> = result
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect();
    let counterparts: BTreeMap<_, _> = result
        .pairing
        .entries
        .iter()
        .filter_map(|pair| {
            let left = before.entries.get(pair.before?)?;
            let right = current.entries.get(pair.after?)?;
            (left.content.kind() == EntryKind::Component
                && right.content.kind() == EntryKind::Component)
                .then_some((right.metadata.path.as_str(), left.metadata.path.as_str()))
        })
        .collect();
    for (path, detail) in details {
        if !matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component) {
            continue;
        }
        let Some(classification) = classifications.get(path.as_str()) else {
            continue;
        };
        let workspace = detail.workspace.get_or_insert_with(|| Workspace {
            comparison_eligible: false,
            used_by: Vec::new(),
            affected: Vec::new(),
            related_components: Vec::new(),
            input_changes: Vec::new(),
        });
        workspace.comparison_eligible = eligible(classification)
            || result
                .review
                .affected
                .iter()
                .any(|effect| effect.consumer.path == *path);
        for usage in &mut workspace.used_by {
            usage.comparison_eligible = classifications
                .get(usage.entry_path.as_str())
                .is_some_and(|entry| eligible(entry))
                || result
                    .review
                    .affected
                    .iter()
                    .any(|effect| effect.consumer.path == usage.entry_path);
        }
        let parent = index
            .components
            .iter()
            .find(|entry| entry.entry.path == *path)
            .and_then(|entry| entry.variant_of.as_deref())
            .or_else(|| {
                before
                    .entries
                    .iter()
                    .find(|entry| entry.metadata.path == *path)
                    .and_then(|entry| entry.metadata.variant_of.as_deref())
            })
            .unwrap_or(path);
        for effect in &result.review.affected {
            if effect.consumer.path == *path {
                let related = RelatedComponent {
                    path: effect.changed_component_id.clone(),
                    title: titles
                        .get(effect.changed_component_id.as_str())
                        .copied()
                        .unwrap_or(&effect.changed_component_id)
                        .into(),
                };
                if !workspace.related_components.contains(&related) {
                    workspace.related_components.push(related);
                }
            }
            if effect.changed_component_id != parent {
                continue;
            }
            let removed = result
                .snapshot
                .removed_entries
                .iter()
                .any(|entry| entry.entry.metadata().path == effect.consumer.path);
            for evidence in &effect.evidence {
                if evidence.side == ReviewSide::Before
                    && effect.evidence.iter().any(|after| {
                        after.side == ReviewSide::After
                            && after.context.viewport == evidence.context.viewport
                            && after.context.color_scheme == evidence.context.color_scheme
                            && after.via.last().map(|instance| &instance.instance_key)
                                == evidence.via.last().map(|instance| &instance.instance_key)
                    })
                {
                    continue;
                }
                let Some(instance) = evidence.via.last() else {
                    continue;
                };
                let link = UsageLink {
                    entry_path: effect.consumer.path.clone(),
                    entry_kind: match effect.consumer.kind {
                        ConsumerKind::Screen => VisualKind::Screen,
                        ConsumerKind::Component => VisualKind::Component,
                    },
                    title: titles
                        .get(effect.consumer.path.as_str())
                        .copied()
                        .unwrap_or(&evidence.context.entry.title)
                        .into(),
                    viewport: evidence.context.viewport,
                    color_scheme: evidence.context.color_scheme,
                    instance_key: instance.instance_key.clone(),
                    direct: evidence.via.len() == 1,
                    removed,
                    comparison_eligible: !removed
                        || effect.consumer.kind == ConsumerKind::Component,
                };
                if !workspace.affected.contains(&link) {
                    workspace.affected.push(link);
                }
            }
        }
        for document in &classification.documents {
            let Some(route) = &document.before_route else {
                continue;
            };
            let Some(viewport) = document.key.viewport else {
                continue;
            };
            let Some(view) = detail.views.iter().find(|view| {
                view.viewport == viewport && view.color_scheme == document.key.color_scheme
            }) else {
                continue;
            };
            let CatalogueUsage::Ready {
                instances: after, ..
            } = &view.usage
            else {
                continue;
            };
            let previous = graph(result.before.comparison_document(route))?;
            let Some(document) = &previous.document else {
                continue;
            };
            let CatalogueUsage::Ready {
                instances: before, ..
            } = &document.usage
            else {
                continue;
            };
            let inputs: BTreeMap<_, _> = before
                .iter()
                .map(|instance| (instance.key.as_str(), instance))
                .collect();
            for instance in after {
                if !matches!(instance.owner, ComponentInputOwner::Entry) {
                    continue;
                }
                let Some(component) = counterparts.get(instance.component_id.as_str()) else {
                    continue;
                };
                let Some(previous) = inputs.get(instance.key.as_str()) else {
                    continue;
                };
                if previous.component_id.as_str() != *component
                    || instance.props_key == previous.props_key
                {
                    continue;
                }
                workspace.input_changes.push(InputChange {
                    instance_id: instance.id.clone(),
                    title: titles
                        .get(instance.component_id.as_str())
                        .copied()
                        .unwrap_or(&instance.component_id)
                        .into(),
                    viewport,
                    color_scheme: view.color_scheme,
                    variant_path: current
                        .entries
                        .iter()
                        .find(|entry| entry.metadata.path == *path)
                        .and_then(|entry| entry.metadata.variant_of.as_ref())
                        .map(|_| path.clone()),
                    before: previous.props.clone(),
                    after: instance.props.clone(),
                });
            }
        }
    }
    Ok(())
}
