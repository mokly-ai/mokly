//! One-level saved variants and metadata inheritance.

use std::collections::BTreeSet;

use mokly_model::axes::EntryKind;
use serde_json::Value;

use crate::diagnostic::{Code, Issue};
use crate::input::{ParsedEntry, VariantInput};
use crate::parsing::{issue, valid_tag};

pub(crate) fn parse(
    parsed: &ParsedEntry,
    kind: EntryKind,
    file: &str,
    parent: &str,
) -> Vec<Result<VariantInput, Issue>> {
    parsed
        .input
        .variants
        .iter()
        .enumerate()
        .map(|(index, value)| variant(value, index, parsed, kind, file, parent))
        .collect()
}

fn variant(
    value: &Value,
    index: usize,
    parsed: &ParsedEntry,
    kind: EntryKind,
    file: &str,
    parent: &str,
) -> Result<VariantInput, Issue> {
    let slug = value.get("slug").and_then(Value::as_str).unwrap_or("");
    let path = format!("{parent}/{slug}");
    let failure = |field: &str, code: Code, message: String| {
        issue(
            &parsed.document,
            file,
            &format!("variants/{index}/{field}"),
            code,
            message,
        )
    };
    let Some(object) = value.as_object() else {
        return Err(failure(
            "",
            Code::HtmlFrontMatter,
            "variant must be an object".into(),
        ));
    };
    if object.contains_key("variants") {
        return Err(failure(
            "variants",
            Code::InvalidVariants,
            "a variant cannot declare variants".into(),
        ));
    }
    for key in object.keys() {
        let common = matches!(
            key.as_str(),
            "slug" | "title" | "description" | "tags" | "movedFrom" | "props"
        );
        let specific = if kind == EntryKind::Screen {
            matches!(
                key.as_str(),
                "colorSchemes" | "address" | "rationale" | "relatedDocs" | "useCasePaths"
            )
        } else {
            key == "slots"
        };
        if !common && !specific {
            return Err(failure(
                key,
                Code::InvalidField,
                format!("{path}: unknown field {key}"),
            ));
        }
    }
    for key in ["description", "movedFrom", "address", "rationale"] {
        if object.get(key).is_some_and(|value| !value.is_string()) {
            return Err(failure(
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be a string"),
            ));
        }
    }
    for key in ["tags", "colorSchemes", "relatedDocs", "useCasePaths"] {
        if object.get(key).is_some_and(|value| {
            !value
                .as_array()
                .is_some_and(|items| items.iter().all(Value::is_string))
        }) {
            return Err(failure(
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be an array of strings"),
            ));
        }
    }
    let variant: VariantInput = match serde_json::from_value(value.clone()) {
        Ok(variant) => variant,
        Err(error) => {
            return Err(failure(
                "",
                Code::HtmlFrontMatter,
                format!("{path}: {error}"),
            ));
        }
    };
    let mut seen = BTreeSet::new();
    if variant.title.is_empty() || variant.title != variant.title.trim() {
        return Err(failure(
            "title",
            Code::HtmlFrontMatter,
            "title must be a nonempty string without leading or trailing whitespace".into(),
        ));
    }
    if variant
        .tags
        .iter()
        .flatten()
        .any(|tag| !valid_tag(tag) || !seen.insert(tag))
    {
        return Err(failure(
            "tags",
            Code::HtmlFrontMatter,
            "tags must be an array of unique lowercase kebab-case tags".into(),
        ));
    }
    Ok(variant)
}
