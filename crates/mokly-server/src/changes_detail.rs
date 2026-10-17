//! Compose shared usage, comparison evidence, and workspace projections for Serve.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_compare::{projection_detail, projection_workspace};
use mokly_model::projection_usage;

use crate::comparison_metadata::compared;
use crate::error::Result;
use crate::snapshot::Snapshot;

pub(crate) fn apply(next: &mut Snapshot) -> Result<()> {
    let mut details: BTreeMap<_, _> = next
        .details
        .iter()
        .map(|(path, detail)| {
            let mut detail = (**detail).clone();
            for view in &mut detail.views {
                view.resource_evidence = None;
            }
            detail.resource_evidence = None;
            detail.workspace = None;
            (path.clone(), detail)
        })
        .collect();
    let references = details
        .iter()
        .map(|(path, detail)| (path.clone(), detail))
        .collect();
    for (path, workspace) in projection_usage::workspaces(&references, &next.index) {
        if let Some(detail) = details.get_mut(&path) {
            detail.workspace = Some(workspace);
        }
    }
    if let Some(accepted) = &next.changes {
        projection_detail::apply_evidence(&mut details, &accepted.result);
        compared(projection_workspace::apply(&mut details, &accepted.result))?;
    }
    next.details = details
        .into_iter()
        .map(|(path, detail)| (path, Arc::new(detail)))
        .collect();
    Ok(())
}
