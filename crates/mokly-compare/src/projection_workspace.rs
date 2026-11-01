//! Shared workspace projection for static output and Serve.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::public_detail::EntryDetailV4;

use crate::comparison_types::ComparisonResult;
use crate::error::Result;
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
    let context = Context::new(result);
    let affected = projection_affected::index(result, &context)?;
    for (path, detail) in details {
        if !matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component) {
            continue;
        }
        let Some(classification) = context.classifications.get(path.as_str()) else {
            continue;
        };
        let Some(mut workspace) = detail.workspace.take() else {
            continue;
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
            .get(path.as_str())
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
            &context,
            result,
        )?;
        detail.workspace = Some(workspace);
    }
    Ok(())
}
