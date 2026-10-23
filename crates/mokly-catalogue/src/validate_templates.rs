//! Validate shared HTML templates and statically known logical links.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::catalogue::EntryContent;
use mokly_model::prop_schema::PropSchema;

use crate::diagnostic::Issue;
use crate::preparation::PreparedCatalogue;
use crate::template_role::TemplateRole;
use crate::template_types::Template;
use crate::{links, registry, templates};

pub(crate) fn validate(
    prepared: &mut PreparedCatalogue,
    failed: &BTreeSet<String>,
    markdown_targets: &BTreeMap<String, Vec<links::MarkdownTarget>>,
) -> Vec<Issue> {
    let mut issues = Vec::new();
    let mut edges = BTreeMap::new();
    for entry in &prepared.model.entries {
        if failed.contains(&entry.metadata.path) {
            continue;
        }
        if entry.metadata.variant_of.is_some() {
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
                schema,
                TemplateRole::EntryBody {
                    path: &entry.metadata.path,
                    slots,
                },
                &prepared.elements,
                failed,
            );
            let components = result.components;
            issues.extend(result.issues);
            prepared.warnings.extend(result.warnings);
            issues.extend(links::html(
                template,
                entry,
                &prepared.model.entries,
                &prepared.elements,
            ));
            if let EntryContent::Component { .. } = &entry.content {
                for variant in prepared
                    .model
                    .entries
                    .iter()
                    .filter(|variant| variant.metadata.variant_of.as_deref() == Some(parent))
                {
                    let EntryContent::Component { visual, slots, .. } = &variant.content else {
                        continue;
                    };
                    for (name, saved) in prepared
                        .slot_fragments
                        .get(&variant.metadata.path)
                        .into_iter()
                        .flat_map(|fragments| fragments.iter())
                    {
                        let template = Template {
                            source_path: variant.metadata.source.path.clone(),
                            source: saved.body.clone(),
                            body: saved.body.clone(),
                            body_offset: 0,
                            page: false,
                        };
                        let result = templates::validate(
                            &template,
                            &visual.prop_schema,
                            TemplateRole::SavedSlot {
                                parent,
                                slots: slots.as_slice(),
                                source: &saved.source,
                            },
                            &prepared.elements,
                            failed,
                        );
                        issues.extend(result.issues);
                        prepared.warnings.extend(result.warnings);
                        issues.extend(links::html(
                            &template,
                            variant,
                            &prepared.model.entries,
                            &prepared.elements,
                        ));
                        tracing::debug!(slot = name, path = %variant.metadata.path, "validated saved variant slot");
                    }
                }
                edges.insert(entry.metadata.path.clone(), components);
            }
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
