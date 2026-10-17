//! Current detail evidence follows the classification installed with its index.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::axes::EntryKind;
use mokly_model::projection_usage;

use crate::changes_workspace;
use crate::error::Result;
use crate::snapshot::Snapshot;

pub(crate) fn apply(next: &mut Snapshot) -> Result<()> {
    let classifications: BTreeMap<_, _> = next
        .changes
        .iter()
        .flat_map(|accepted| &accepted.result.entries)
        .map(|entry| (entry.path.as_str(), entry))
        .collect();
    for (path, detail) in &mut next.details {
        let detail = Arc::make_mut(detail);
        let entry = classifications.get(path.as_str());
        for view in &mut detail.views {
            view.resource_evidence = entry
                .and_then(|entry| {
                    entry.documents.iter().find(|document| {
                        document.key.viewport == Some(view.viewport)
                            && document.key.color_scheme == view.color_scheme
                    })
                })
                .map(|document| document.evidence.clone());
        }
        detail.resource_evidence = if detail.entry.kind == EntryKind::Page {
            entry
                .and_then(|entry| entry.documents.first())
                .map(|document| document.evidence.clone())
        } else {
            None
        };
        detail.workspace = None;
    }
    let details = next
        .details
        .iter()
        .map(|(path, detail)| (path.clone(), detail.as_ref()))
        .collect();
    for (path, workspace) in projection_usage::workspaces(&details, &next.index) {
        if let Some(detail) = next.details.get_mut(&path) {
            Arc::make_mut(detail).workspace = Some(workspace);
        }
    }
    if let Some(accepted) = &next.changes {
        changes_workspace::apply(&mut next.details, &next.index, &accepted.result)?;
    }
    Ok(())
}
