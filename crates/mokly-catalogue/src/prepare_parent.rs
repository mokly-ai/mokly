//! Prepare a parent while retaining invalid definitions for identity and relationships.

use mokly_model::axes::{ColorScheme, EntryKind};
use mokly_model::catalogue::{SourceLocation, VisualEntry};
use mokly_model::controls;
use mokly_model::data::merge_props;
use mokly_model::inference::infer;
use mokly_model::validation::PropValidator;

use crate::diagnostic::{Code, Issue};
use crate::input::{ParsedEntry, VariantInput};
use crate::{declared_controls, props};

pub(crate) struct Parent {
    pub(crate) visual: VisualEntry,
    pub(crate) validator: Option<PropValidator>,
    pub(crate) issues: Vec<Issue>,
}

pub(crate) fn prepare(
    parsed: &ParsedEntry,
    kind: EntryKind,
    source: &SourceLocation,
    configured: &[ColorScheme],
    candidates: &[Result<VariantInput, Issue>],
) -> Parent {
    let input = &parsed.input;
    let merged: Vec<_> = candidates
        .iter()
        .filter_map(|candidate| candidate.as_ref().ok())
        .map(|variant| merge_props(&input.props, &variant.props))
        .collect();
    let inferred = infer(&input.props, &merged);
    let mut parent = Parent {
        visual: VisualEntry {
            color_schemes: configured.into(),
            prop_schema: inferred.clone(),
            props: input.props.clone(),
            controls: Default::default(),
        },
        validator: None,
        issues: parsed.issues.clone(),
    };
    if !parent.issues.is_empty() {
        return parent;
    }
    let result = || {
        let scheme_source = parsed
            .document
            .positions
            .get("/colorSchemes")
            .unwrap_or(source);
        let schemes = props::schemes(input.color_schemes.as_deref(), configured, scheme_source)?;
        if kind == EntryKind::Component
            && source.export.is_some()
            && input.prop_schema.is_none()
            && !input.infer_component_schema
        {
            return Err(Issue::new(
                Code::ComponentSchema,
                "propSchema is required for a component",
            )
            .at(source.clone()));
        }
        let schema = match &input.prop_schema {
            Some(schema) => schema.clone(),
            None => match serde_json::to_value(&inferred) {
                Ok(schema) => schema,
                Err(error) => {
                    return Err(
                        Issue::new(Code::HtmlFrontMatter, error.to_string()).at(source.clone())
                    );
                }
            },
        };
        let validator = props::compile(&schema, parsed, source)?;
        props::declarations(
            validator.schema(),
            &input.slots,
            kind == EntryKind::Component,
            parsed,
            source,
        )?;
        props::validate(&validator, &input.props, None, parsed, source)?;
        if let Some(controls) = &input.controls {
            declared_controls::validate(validator.schema(), controls, &input.props, source)?;
        }
        Ok((schemes, validator))
    };
    match result() {
        Ok((schemes, validator)) => {
            parent.visual.color_schemes = schemes;
            parent.visual.prop_schema = validator.schema().clone();
            parent.visual.controls = input
                .controls
                .as_ref()
                .map(|controls| declared_controls::effective(validator.schema(), controls))
                .unwrap_or_else(|| controls::derive(validator.schema()));
            parent.validator = Some(validator);
        }
        Err(issue) => parent.issues.push(issue),
    }
    parent
}
