//! Compare only caller-owned props for accepted component counterparts.

use std::collections::BTreeMap;

use mokly_model::public_detail::{EntryDetailV4, InputChange, Workspace};
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};

use crate::comparison_error::CompareResult;
use crate::comparison_types::{ComparisonResult, EntryClassification};
use crate::error::Result;
use crate::projection_context::Context;

pub(crate) fn append(
    path: &str,
    detail: &EntryDetailV4,
    workspace: &mut Workspace,
    classification: &EntryClassification,
    context: &Context<'_>,
    result: &ComparisonResult,
) -> Result<()> {
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
        let previous = result.before.comparison_document(route).compare()?;
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
            let Some(component) = context.counterparts.get(instance.component_id.as_str()) else {
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
                title: context
                    .metadata
                    .get(instance.component_id.as_str())
                    .map_or(instance.component_id.as_str(), |metadata| {
                        metadata.title.as_str()
                    })
                    .into(),
                viewport,
                color_scheme: view.color_scheme,
                variant_path: context
                    .metadata
                    .get(path)
                    .and_then(|metadata| metadata.variant_of.as_ref())
                    .map(|_| path.to_owned()),
                before: previous.props.clone(),
                after: instance.props.clone(),
            });
        }
    }
    Ok(())
}
