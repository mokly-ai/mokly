//! One schema compilation and one validation per complete props set.

use std::collections::BTreeSet;

use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::SourceLocation;
use mokly_model::data::Props;
use mokly_model::diagnostic::{AuthoringKind, Context};
use mokly_model::error::ModelError;
use mokly_model::prop_schema::PropSchema;
use mokly_model::validation::PropValidator;
use serde_json::Value;

use crate::diagnostic::{Code, Issue};
use crate::input::ParsedEntry;
use crate::parsing::issue;

pub(crate) fn compile(
    schema: &Value,
    parsed: &ParsedEntry,
    source: &SourceLocation,
) -> Result<PropValidator, Issue> {
    let context = Context {
        entry: source.path.clone(),
        variant: None,
        kind: if source.export.is_some() {
            AuthoringKind::JavaScript
        } else {
            AuthoringKind::Html
        },
    };
    match PropValidator::compile(schema, &context) {
        Ok(validator) => Ok(validator),
        Err(error) => Err(from_model(error, parsed, source, "propSchema", None)),
    }
}

pub(crate) fn validate(
    validator: &PropValidator,
    props: &Props,
    variant: Option<(&str, usize)>,
    parsed: &ParsedEntry,
    source: &SourceLocation,
) -> Result<(), Issue> {
    let context = Context {
        entry: source.path.clone(),
        variant: variant.map(|(slug, _)| slug.into()),
        kind: if source.export.is_some() {
            AuthoringKind::JavaScript
        } else {
            AuthoringKind::Html
        },
    };
    let value = match serde_json::to_value(props) {
        Ok(value) => value,
        Err(error) => {
            return Err(Issue::new(Code::HtmlAttribute, error.to_string()).at(source.clone()));
        }
    };
    match validator.validate(&value, &context) {
        Ok(()) => Ok(()),
        Err(error) => Err(from_model(error, parsed, source, "props", variant)),
    }
}

fn from_model(
    error: ModelError,
    parsed: &ParsedEntry,
    source: &SourceLocation,
    field: &str,
    variant: Option<(&str, usize)>,
) -> Issue {
    match error {
        ModelError::Schema(diagnostic) | ModelError::Props(diagnostic) => {
            let code = if field == "propSchema" {
                if source.export.is_some() {
                    Code::ComponentSchema
                } else {
                    Code::HtmlFrontMatter
                }
            } else {
                if source.export.is_some() {
                    Code::ComponentProps
                } else {
                    Code::HtmlAttribute
                }
            };
            let prefix = variant.map_or(String::new(), |(slug, _)| format!("variant {slug} "));
            let pointer = if let Some((_, index)) = variant {
                format!("variants/{index}/{field}{}", diagnostic.path)
            } else {
                format!("{field}{}", diagnostic.path)
            };
            issue(
                &parsed.document,
                &source.path,
                &pointer,
                code,
                format!("{prefix}at {:?}: {}", diagnostic.path, diagnostic.message),
            )
        }
        ModelError::Internal(error) => {
            Issue::new(Code::HtmlFrontMatter, error.to_string()).at(source.clone())
        }
    }
}

pub(crate) fn schemes(
    input: Option<&[ColorScheme]>,
    inherited: &[ColorScheme],
    source: &SourceLocation,
) -> Result<Vec<ColorScheme>, Issue> {
    let mut schemes = input.unwrap_or(inherited).to_vec();
    let mut seen = BTreeSet::new();
    if schemes.is_empty()
        || !schemes.contains(&ColorScheme::Light)
        || schemes
            .iter()
            .any(|scheme| !seen.insert(*scheme) || !inherited.contains(scheme))
    {
        return Err(Issue::new(
            Code::HtmlFrontMatter,
            "colorSchemes must be a nonempty unique subset including light",
        )
        .at(source.clone()));
    }
    schemes.sort();
    Ok(schemes)
}

pub(crate) fn declarations(
    schema: &PropSchema,
    slots: &[String],
    component: bool,
    parsed: &ParsedEntry,
    source: &SourceLocation,
) -> Result<(), Issue> {
    let properties = schema.properties.as_ref();
    let mut seen = BTreeSet::new();
    for name in properties.into_iter().flat_map(|props| props.keys()) {
        let field = if parsed.input.prop_schema.is_some() {
            format!("propSchema/properties/{name}")
        } else {
            format!("props/{name}")
        };
        if source.export.is_none() && !prop_name(name) {
            return Err(issue(
                &parsed.document,
                &source.path,
                &field,
                Code::HtmlFrontMatter,
                format!("invalid prop name {name}"),
            ));
        }
        let reserved_input = component
            && matches!(
                name.as_str(),
                "moklyInstance" | "key" | "ref" | "__moklySource"
            );
        if component
            && matches!(
                name.as_str(),
                "moklyInstance" | "key" | "ref" | "__moklySource"
            )
            || component
                && parsed.input.element.is_some()
                && matches!(
                    name.as_str(),
                    "to" | "fragment" | "slot" | "moklyViewport" | "moklyIf"
                )
        {
            return Err(issue(
                &parsed.document,
                &source.path,
                &field,
                if source.export.is_some() {
                    if reserved_input {
                        Code::ComponentSlots
                    } else {
                        Code::ComponentElement
                    }
                } else {
                    Code::HtmlAttribute
                },
                format!("reserved prop name {name}"),
            ));
        }
    }
    for name in slots {
        if source.export.is_none() && !prop_name(name)
            || !seen.insert(name)
            || properties.is_some_and(|props| props.contains_key(name))
            || matches!(
                name.as_str(),
                "moklyInstance" | "key" | "ref" | "__moklySource"
            )
        {
            return Err(issue(
                &parsed.document,
                &source.path,
                "slots",
                if source.export.is_some() {
                    Code::ComponentSlots
                } else {
                    Code::HtmlSlot
                },
                format!("invalid or conflicting slot name {name}"),
            ));
        }
    }
    Ok(())
}

fn prop_name(name: &str) -> bool {
    name.bytes()
        .next()
        .is_some_and(|first| first.is_ascii_alphabetic())
        && name
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
}
