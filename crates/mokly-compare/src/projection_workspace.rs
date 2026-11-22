//! Shared workspace projection for static output and Serve.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::public_detail::{EntryDetailV4, Workspace};

use crate::comparison_types::ComparisonResult;
use crate::error::Result;
use crate::projection_affected::Affected;
use crate::projection_context::Context;
use crate::{projection_affected, projection_inputs};

/// Join current usage with retained comparison evidence without changing document bytes.
/// The caller supplies settled view usage and current Used by lists.
/// This updates comparison-owned fields and retains those Used by rows.
/// An absent workspace stays absent. An absent list stays absent until the
/// caller proves its usage inputs.
/// Metadata, counterparts, removals, and consumer links are indexed once for the batch.
pub fn apply(
    details: &mut BTreeMap<String, EntryDetailV4>,
    result: &ComparisonResult,
) -> Result<()> {
    let projection = WorkspaceProjection::new(result);
    for (path, detail) in details {
        let workspace = detail.workspace.take();
        detail.workspace = projection.workspace(path, detail, workspace)?;
    }
    Ok(())
}

/// Metadata, counterparts, removals, and consumer links of one result, indexed once so
/// that each detail's workspace can be projected on its own.
pub struct WorkspaceProjection<'a> {
    context: Context<'a>,
    affected: Affected,
    result: &'a ComparisonResult,
}

impl<'a> WorkspaceProjection<'a> {
    /// Index the shared facts of `result`.
    pub fn new(result: &'a ComparisonResult) -> Self {
        let context = Context::new(result);
        let affected = projection_affected::index(result, &context);
        Self {
            context,
            affected,
            result,
        }
    }

    /// Project the settled `workspace` of the detail at `path`, as `apply` does.
    /// The detail supplies only its kind and its view usage, not its own workspace.
    /// Other kinds, unclassified entries, and an absent workspace keep `workspace`.
    pub fn workspace(
        &self,
        path: &str,
        detail: &EntryDetailV4,
        workspace: Option<Workspace>,
    ) -> Result<Option<Workspace>> {
        let context = &self.context;
        let affected = &self.affected;
        if !matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component) {
            return Ok(workspace);
        }
        let Some(classification) = context.classifications.get(path) else {
            return Ok(workspace);
        };
        let Some(mut workspace) = workspace else {
            return Ok(None);
        };
        workspace.comparison_eligible = context.can_compare(path, detail.entry.kind)
            && (context.eligible(classification) || affected.consumers.contains(path));
        if let Some(used_by) = workspace.used_by.as_mut() {
            for usage in used_by {
                usage.comparison_eligible = context
                    .classifications
                    .get(usage.entry_path.as_str())
                    .is_some_and(|entry| {
                        context.can_compare(&entry.path, entry.kind)
                            && (context.eligible(entry) || affected.consumers.contains(&entry.path))
                    });
            }
        }
        let parent = context
            .metadata
            .get(path)
            .and_then(|metadata| metadata.variant_of.as_deref())
            .unwrap_or(path);
        workspace.related_components = affected.related.get(path).cloned().unwrap_or_default();
        if workspace.affected.is_some() {
            workspace.affected = Some(affected.links.get(parent).cloned().unwrap_or_default());
        }
        workspace.input_changes.clear();
        projection_inputs::append(
            path,
            detail,
            &mut workspace,
            classification,
            context,
            self.result,
        )?;
        Ok(Some(workspace))
    }
}
