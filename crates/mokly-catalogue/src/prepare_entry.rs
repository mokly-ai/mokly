//! Prepare one parent and its variants before catalogue-wide relationship checks.

use mokly_model::axes::{ColorScheme, EntryKind};
use mokly_model::catalogue::{
    EntryContent, EntryMetadata, ModelEntry, SourceLocation, VisualEntry,
};
use mokly_model::controls;
use mokly_model::data::merge_props;
use mokly_model::inference::infer;
use serde_json::Value;

use crate::config_types::ResolvedRoot;
use crate::diagnostic::{Code, Issue};
use crate::discovery::SourceFile;
use crate::identity::{derive, segment};
use crate::input::ParsedEntry;
use crate::parsing::issue;
use crate::{props, variants};

pub(crate) fn prepare(
    parsed: &ParsedEntry,
    file: &SourceFile,
    root: &ResolvedRoot,
    kind: EntryKind,
    source: SourceLocation,
    configured_schemes: &[ColorScheme],
) -> Result<(Vec<ModelEntry>, Vec<Issue>), Issue> {
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
        return Ok((vec![ModelEntry { metadata, content }], Vec::new()));
    }
    let color_schemes =
        props::schemes(input.color_schemes.as_deref(), configured_schemes, &source)?;
    let candidates = variants::parse(parsed, kind, &file.path, &path);
    let merged: Vec<_> = candidates
        .iter()
        .filter_map(|candidate| candidate.as_ref().ok())
        .map(|variant| merge_props(&input.props, &variant.props))
        .collect();
    let inferred;
    let schema = if let Some(schema) = &input.prop_schema {
        schema
    } else {
        inferred = match serde_json::to_value(infer(&input.props, &merged)) {
            Ok(value) => value,
            Err(error) => {
                return Err(Issue::new(Code::HtmlFrontMatter, error.to_string()).at(source.clone()));
            }
        };
        &inferred
    };
    let validator = props::compile(schema, parsed, &source)?;
    props::declarations(
        validator.schema(),
        &input.slots,
        input.element.as_deref(),
        &source,
    )?;
    props::validate(&validator, &input.props, None, parsed, &source)?;
    let visual = VisualEntry {
        color_schemes,
        prop_schema: validator.schema().clone(),
        props: input.props.clone(),
        controls: controls::derive(validator.schema()),
    };
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
    let mut entries = vec![parent.clone()];
    let mut issues = Vec::new();
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
        if let Err(issue) = props::validate(
            &validator,
            &complete,
            Some((&variant.slug, index)),
            parsed,
            &source,
        ) {
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
                &entry.metadata.source,
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
            prop_schema: validator.schema().clone(),
            props: complete,
            controls: controls::derive(validator.schema()),
        };
        if variant.slots.keys().any(|name| !input.slots.contains(name)) {
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
    Ok((entries, issues))
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
