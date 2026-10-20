//! Prepare one parent and its variants before catalogue-wide relationship checks.

use mokly_model::axes::{ColorScheme, EntryKind};
use mokly_model::catalogue::{
    EntryContent, EntryMetadata, ModelEntry, SourceLocation, VisualEntry,
};
use mokly_model::data::merge_props;
use serde_json::Value;

use crate::config_types::ResolvedRoot;
use crate::diagnostic::{Code, Issue, Warning};
use crate::discovery::SourceFile;
use crate::identity::{derive, segment};
use crate::input::ParsedEntry;
use crate::parsing::issue;
use crate::{declared_controls, numeric_warnings, prepare_parent, props, variants};

pub(crate) struct PreparedEntries {
    pub(crate) entries: Vec<ModelEntry>,
    pub(crate) issues: Vec<Issue>,
    pub(crate) warnings: Vec<Warning>,
    pub(crate) failed: bool,
}

pub(crate) fn prepare(
    parsed: &ParsedEntry,
    file: &SourceFile,
    root: &ResolvedRoot,
    kind: EntryKind,
    source: SourceLocation,
    configured_schemes: &[ColorScheme],
) -> Result<PreparedEntries, Issue> {
    let input = &parsed.input;
    let path_source = parsed.document.positions.get("/path").unwrap_or(&source);
    let (path, is_index) = derive(input, file, root, path_source)?;
    let metadata = EntryMetadata {
        path: path.clone(),
        title: input.title.clone(),
        description: input.description.clone(),
        tags: input.tags.clone(),
        rationale: input.rationale.clone(),
        related_docs: input.related_docs.clone(),
        moved_from: input.moved_from.clone(),
        moved_from_source: parsed.document.positions.get("/movedFrom").cloned(),
        variant_of: None,
        is_index,
        source: source.clone(),
        root_index: file.root_index,
    };
    if !matches!(kind, EntryKind::Screen | EntryKind::Component) {
        let content = match kind {
            EntryKind::Document => EntryContent::Document {
                color_schemes: configured_schemes.into(),
                resources: Vec::new(),
            },
            EntryKind::UseCase => EntryContent::UseCase {
                steps: input.steps.clone(),
            },
            _ => EntryContent::Page,
        };
        return Ok(PreparedEntries {
            entries: vec![ModelEntry { metadata, content }],
            issues: parsed.issues.clone(),
            warnings: Vec::new(),
            failed: !parsed.issues.is_empty(),
        });
    }
    let candidates = variants::parse(parsed, kind, &file.path, &path);
    let prepared_parent =
        prepare_parent::prepare(parsed, kind, &source, configured_schemes, &candidates);
    let validator = prepared_parent.validator;
    let failed = validator.is_none();
    let schema = prepared_parent.visual.prop_schema.clone();
    let controls = prepared_parent.visual.controls.clone();
    let control_order = prepared_parent.visual.control_order.clone();
    let visual = prepared_parent.visual;
    let content = visual_content(
        kind,
        visual,
        input.element.clone(),
        input.slots.clone(),
        Vec::new(),
        input.address.clone(),
        input.use_case_paths.clone(),
    );
    let parent = ModelEntry { metadata, content };
    let warnings = input.controls.as_ref().map_or_else(Vec::new, |controls| {
        numeric_warnings::for_controls(controls, &parent)
    });
    let mut entries = vec![parent.clone()];
    let mut issues = prepared_parent.issues;
    for (index, candidate) in candidates.into_iter().enumerate() {
        let variant = match candidate {
            Ok(variant) => variant,
            Err(issue) => {
                issues.push(issue);
                continue;
            }
        };
        let variant_source = parsed
            .document
            .positions
            .get(&format!("/variants/{index}/slug"))
            .cloned()
            .unwrap_or(source.clone());
        if let Err(issue) = segment(&variant.slug, "slug", &variant_source) {
            issues.push(issue);
            continue;
        }
        let complete = merge_props(&input.props, &variant.props);
        if let Some(validator) = &validator
            && let Err(issue) = props::validate(
                validator,
                &complete,
                Some((&variant.slug, index)),
                parsed,
                &source,
            )
        {
            issues.push(issue);
            continue;
        }
        if !failed
            && let Some(controls) = &input.controls
            && let Err(issue) = declared_controls::prepare(&schema, controls, &complete, &source)
        {
            issues.push(issue);
            continue;
        }
        let mut entry = parent.clone();
        entry.metadata.path = format!("{path}/{}", variant.slug);
        entry.metadata.variant_of = Some(path.clone());
        entry.metadata.is_index = false;
        entry.metadata.source = variant_source;
        entry.metadata.title = variant.title.clone();
        entry.metadata.description = variant
            .description
            .clone()
            .unwrap_or_else(|| input.description.clone());
        entry.metadata.tags = variant.tags.clone().unwrap_or_else(|| input.tags.clone());
        entry.metadata.related_docs = variant
            .related_docs
            .clone()
            .unwrap_or_else(|| input.related_docs.clone());
        entry.metadata.rationale = variant.rationale.clone();
        entry.metadata.moved_from = variant.moved_from.clone();
        entry.metadata.moved_from_source = parsed
            .document
            .positions
            .get(&format!("/variants/{index}/movedFrom"))
            .cloned();
        let visual = VisualEntry {
            color_schemes: match props::schemes(
                variant.color_schemes.as_deref(),
                configured_schemes,
                parsed
                    .document
                    .positions
                    .get(&format!("/variants/{index}/colorSchemes"))
                    .unwrap_or(&entry.metadata.source),
            ) {
                Ok(schemes) => {
                    if variant.color_schemes.is_none() {
                        match &parent.content {
                            EntryContent::Screen { visual, .. }
                            | EntryContent::Component { visual, .. } => {
                                visual.color_schemes.clone()
                            }
                            _ => schemes,
                        }
                    } else {
                        schemes
                    }
                }
                Err(issue) => {
                    issues.push(issue);
                    continue;
                }
            },
            prop_schema: schema.clone(),
            props: complete,
            controls: controls.clone(),
            control_order: control_order.clone(),
        };
        if !failed && variant.slots.keys().any(|name| !input.slots.contains(name)) {
            issues.push(issue(
                &parsed.document,
                &file.path,
                &format!("variants/{index}/slots"),
                Code::HtmlSlot,
                "content for an undeclared slot",
            ));
            continue;
        }
        let mut supplied: Vec<_> = variant.slots.keys().cloned().collect();
        supplied.sort_by(|a, b| mokly_model::canonical::compare_utf16(a, b));
        entry.content = visual_content(
            kind,
            visual,
            input.element.clone(),
            input.slots.clone(),
            supplied,
            variant.address.clone().or_else(|| input.address.clone()),
            variant.use_case_paths.clone(),
        );
        entries.push(entry);
    }
    Ok(PreparedEntries {
        entries,
        issues,
        warnings,
        failed,
    })
}

fn visual_content(
    kind: EntryKind,
    visual: VisualEntry,
    element: Option<String>,
    slots: Vec<String>,
    supplied_slots: Vec<String>,
    address: Option<String>,
    use_case_paths: Vec<String>,
) -> EntryContent {
    if kind == EntryKind::Component {
        EntryContent::Component {
            visual,
            element,
            slots,
            supplied_slots,
        }
    } else {
        EntryContent::Screen {
            visual,
            address,
            use_case_paths,
        }
    }
}

pub(crate) fn slot_fragments(value: &Value) -> std::collections::BTreeMap<String, String> {
    value
        .get("slots")
        .and_then(Value::as_object)
        .into_iter()
        .flat_map(|object| object.iter())
        .filter_map(|(name, value)| value.as_str().map(|value| (name.clone(), value.into())))
        .collect()
}
