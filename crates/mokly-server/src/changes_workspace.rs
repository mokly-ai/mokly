//! Ready workspace lists combine current usage with accepted comparison proof.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::public_detail::{
    EntryDetailV1, InputChange, RelatedComponent, UsageLink, VisualKind,
};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::review::ReviewState;
use mokly_model::review_affected::{ConsumerKind, ReviewSide};
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};

use crate::changes_index::eligible;
use crate::error::{Result, ServerError};

pub(crate) fn apply(
    details: &mut BTreeMap<String, Arc<EntryDetailV1>>,
    index: &CatalogueReadModel,
    result: &ComparisonResult,
) -> Result<()> {
    let entries: BTreeMap<_, _> = result
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect();
    let titles: BTreeMap<_, _> = index
        .components
        .iter()
        .map(|entry| (entry.entry.path.as_str(), entry.entry.title.as_str()))
        .collect();
    for (path, detail) in details {
        let detail = Arc::make_mut(detail);
        let Some(workspace) = &mut detail.workspace else {
            continue;
        };
        let Some(entry) = entries.get(path.as_str()) else {
            continue;
        };
        workspace.comparison_eligible = entry
            .documents
            .iter()
            .any(|document| eligible(document.state));
        for link in &mut workspace.used_by {
            link.comparison_eligible = entries.get(link.entry_path.as_str()).is_some_and(|entry| {
                entry.documents.iter().any(|document| {
                    document.key.viewport == Some(link.viewport)
                        && document.key.color_scheme == link.color_scheme
                        && eligible(document.state)
                })
            });
        }
        let parent = index
            .components
            .iter()
            .find(|component| component.entry.path == *path)
            .and_then(|component| component.variant_of.as_deref())
            .unwrap_or(path);
        let mut seen = BTreeSet::new();
        for affected in &result.review.affected {
            if affected.changed_component_id == parent {
                for evidence in &affected.evidence {
                    let Some(instance) = evidence.via.last() else {
                        continue;
                    };
                    let removed = entries
                        .get(affected.consumer.path.as_str())
                        .is_some_and(|entry| entry.state == ReviewState::Removed);
                    if evidence.side == ReviewSide::Before && !removed {
                        continue;
                    }
                    let key = (
                        &affected.consumer.path,
                        evidence.context.viewport,
                        evidence.context.color_scheme,
                        &instance.instance_key,
                        removed,
                    );
                    if !seen.insert(key) {
                        continue;
                    }
                    workspace.affected.push(UsageLink {
                        entry_path: affected.consumer.path.clone(),
                        entry_kind: match affected.consumer.kind {
                            ConsumerKind::Screen => VisualKind::Screen,
                            ConsumerKind::Component => VisualKind::Component,
                        },
                        title: evidence.context.entry.title.clone(),
                        viewport: evidence.context.viewport,
                        color_scheme: evidence.context.color_scheme,
                        instance_key: instance.instance_key.clone(),
                        direct: evidence.via.len() == 1,
                        removed,
                        comparison_eligible: entries
                            .get(affected.consumer.path.as_str())
                            .is_some_and(|entry| {
                                entry.documents.iter().any(|document| {
                                    document.key.viewport == Some(evidence.context.viewport)
                                        && document.key.color_scheme
                                            == evidence.context.color_scheme
                                        && eligible(document.state)
                                })
                            }),
                    });
                }
            }
            if affected.consumer.path == *path
                && !workspace
                    .related_components
                    .iter()
                    .any(|related| related.path == affected.changed_component_id)
                && let Some(title) = titles.get(affected.changed_component_id.as_str())
            {
                workspace.related_components.push(RelatedComponent {
                    path: affected.changed_component_id.clone(),
                    title: (*title).into(),
                });
            }
        }
        for view in &detail.views {
            let Some(document) = entry.documents.iter().find(|document| {
                document.key.viewport == Some(view.viewport)
                    && document.key.color_scheme == view.color_scheme
            }) else {
                continue;
            };
            let Some(route) = &document.before_route else {
                continue;
            };
            let before = match result.before.render(route) {
                Ok(before) => before,
                Err(source) => return Err(ServerError::Render { source }),
            };
            let Some(document) = &before.document else {
                continue;
            };
            let CatalogueUsage::Ready {
                instances: before, ..
            } = &document.usage
            else {
                continue;
            };
            let CatalogueUsage::Ready {
                instances: after, ..
            } = &view.usage
            else {
                continue;
            };
            let before: BTreeMap<_, _> = before
                .iter()
                .map(|instance| (instance.key.as_str(), instance))
                .collect();
            for instance in after
                .iter()
                .filter(|instance| matches!(instance.owner, ComponentInputOwner::Entry))
            {
                let Some(previous) = before.get(instance.key.as_str()) else {
                    continue;
                };
                if previous.props_key == instance.props_key {
                    continue;
                }
                workspace.input_changes.push(InputChange {
                    instance_id: instance.id.clone(),
                    title: titles
                        .get(instance.component_id.as_str())
                        .copied()
                        .unwrap_or(&instance.component_id)
                        .into(),
                    viewport: view.viewport,
                    color_scheme: view.color_scheme,
                    variant_path: index
                        .components
                        .iter()
                        .find(|component| {
                            component.entry.path == *path && component.variant_of.is_some()
                        })
                        .map(|_| path.clone()),
                    before: previous.props.clone(),
                    after: instance.props.clone(),
                });
            }
        }
    }
    Ok(())
}
