//! Validate shared HTML templates and statically known logical links.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::catalogue::EntryContent;
use mokly_model::prop_schema::PropSchema;

use crate::diagnostic::Issue;
use crate::preparation::PreparedCatalogue;
use crate::{links, registry, templates};

pub(crate) fn validate(
    prepared: &mut PreparedCatalogue,
    failed: &BTreeSet<String>,
    markdown_targets: &BTreeMap<String, Vec<links::MarkdownTarget>>,
) -> Vec<Issue> {
    let mut issues = Vec::new();
    let mut edges = BTreeMap::new();
    for entry in &prepared.model.entries {
        if entry.metadata.variant_of.is_some() || failed.contains(&entry.metadata.path) {
            continue;
        }
        let parent = entry
            .metadata
            .variant_of
            .as_ref()
            .unwrap_or(&entry.metadata.path);
        if let Some(template) = prepared.templates.get(parent) {
            let empty = PropSchema::default();
            let (schema, slots) = match &entry.content {
                EntryContent::Screen { visual, .. } => (&visual.prop_schema, None),
                EntryContent::Component { visual, slots, .. } => {
                    (&visual.prop_schema, Some(slots.as_slice()))
                }
                _ => (&empty, None),
            };
            let result = templates::validate(
                template,
                &entry.metadata.path,
                schema,
                slots,
                &prepared.elements,
                failed,
            );
            issues.extend(result.issues);
            prepared.warnings.extend(result.warnings);
            if entry.metadata.variant_of.is_none()
                && matches!(entry.content, EntryContent::Component { .. })
            {
                edges.insert(entry.metadata.path.clone(), result.components);
            }
            issues.extend(links::html(
                template,
                entry,
                &prepared.model.entries,
                &prepared.elements,
            ));
        }
        if let Some(targets) = markdown_targets.get(&entry.metadata.source.path) {
            issues.extend(links::markdown_issues(
                targets,
                entry,
                &prepared.model.entries,
            ));
        }
    }
    issues.extend(registry::cycles(&edges, &prepared.model.entries));
    issues
}
