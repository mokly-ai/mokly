//! Settled comparison evidence and historical detail identity.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_detail, projection_workspace};
use mokly_model::public_detail::EntryDetailV1;

use crate::comparison_files::{compare, graph};
use crate::error::{Error, Result};

pub(crate) fn current(
    details: &mut BTreeMap<String, EntryDetailV1>,
    result: &ComparisonResult,
) -> Result<()> {
    projection_detail::apply_evidence(details, result);
    compare(projection_workspace::apply(details, result))
}

pub(crate) fn historical(
    details: &mut BTreeMap<String, EntryDetailV1>,
    result: &ComparisonResult,
) -> Result<()> {
    let mut plans = BTreeMap::<_, Vec<_>>::new();
    for plan in result.before.plans().values() {
        let entry = result
            .before
            .catalogue()
            .model
            .entries
            .get(plan.entry)
            .ok_or_else(|| Error::PlanEntry {
                route: plan.route.clone(),
                entry: plan.entry,
            })?;
        plans
            .entry(entry.metadata.path.as_str())
            .or_default()
            .push(plan);
    }
    for removed in &result.snapshot.removed_entries {
        let path = removed.entry.metadata().path.as_str();
        let detail = details
            .get_mut(path)
            .ok_or_else(|| Error::Invalid { path: path.into() })?;
        detail.deployment_id = None;
        detail.revision = None;
        detail.generation = Some("0".repeat(64));
        detail.entry.snapshot_id = Some(removed.snapshot_id.clone());
        for plan in plans.get(path).into_iter().flatten() {
            let artifact = graph(result.before.render(&plan.route))?;
            let document = artifact.document.as_ref().ok_or_else(|| Error::Invalid {
                path: plan.route.clone(),
            })?;
            if let Some(view) = detail.views.iter_mut().find(|view| {
                Some(view.viewport) == plan.viewport && view.color_scheme == plan.color_scheme
            }) {
                view.usage = document.usage.clone();
            }
        }
    }
    projection_detail::apply_evidence(details, result);
    Ok(())
}
