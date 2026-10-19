//! Attribute metadata field failures before deserializing recoverable definitions.

use serde_json::{Value, json};

use crate::diagnostic::{Code, Issue};
use crate::discovery::SourceKind;
use crate::parsing::issue;
use crate::yaml::Document;
use crate::yaml_value::discard;

pub(crate) fn validate(
    value: &mut Value,
    document: &Document,
    path: &str,
    kind: SourceKind,
) -> Result<Vec<Issue>, Issue> {
    let Some(object) = value.as_object_mut() else {
        return Err(issue(
            document,
            path,
            "",
            Code::HtmlFrontMatter,
            "front matter must be an object",
        ));
    };
    for key in object.keys() {
        let common = matches!(
            key.as_str(),
            "title" | "description" | "tags" | "path" | "movedFrom" | "rationale" | "relatedDocs"
        );
        let specific = match kind {
            SourceKind::Screen => matches!(
                key.as_str(),
                "address" | "useCasePaths" | "colorSchemes" | "propSchema" | "props" | "variants"
            ),
            SourceKind::Component => matches!(
                key.as_str(),
                "element" | "colorSchemes" | "propSchema" | "props" | "slots" | "variants"
            ),
            SourceKind::UseCase => key == "steps",
            _ => false,
        };
        if !common && !specific {
            return Err(issue(
                document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("unknown field {key}"),
            ));
        }
    }
    let mut issues = Vec::new();
    for key in [
        "title",
        "description",
        "path",
        "movedFrom",
        "rationale",
        "address",
        "element",
    ] {
        if object.get(key).is_some_and(|value| !value.is_string()) {
            return Err(issue(
                document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be a string"),
            ));
        }
    }
    if !object.contains_key("title") {
        return Err(issue(
            document,
            path,
            "title",
            Code::HtmlFrontMatter,
            "title is required",
        ));
    }
    for key in [
        "tags",
        "relatedDocs",
        "useCasePaths",
        "colorSchemes",
        "slots",
    ] {
        if object.get(key).is_some_and(|value| {
            !value
                .as_array()
                .is_some_and(|list| list.iter().all(Value::is_string))
        }) {
            issues.push(issue(
                document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be an array of strings"),
            ));
            if let Some(previous) = object.insert(key.into(), json!([])) {
                discard(previous);
            }
        }
    }
    for key in ["props", "propSchema"] {
        if object.get(key).is_some_and(|value| !value.is_object()) {
            issues.push(issue(
                document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be an object"),
            ));
            if let Some(previous) = object.remove(key) {
                discard(previous);
            }
        }
    }
    for key in ["variants", "steps"] {
        if object.get(key).is_some_and(|value| !value.is_array()) {
            issues.push(issue(
                document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be an array"),
            ));
            if let Some(previous) = object.insert(key.into(), json!([])) {
                discard(previous);
            }
        }
    }
    if kind == SourceKind::Component {
        for required in ["element", "propSchema"] {
            if document.value.get(required).is_none() {
                issues.push(issue(
                    document,
                    path,
                    required,
                    Code::HtmlFrontMatter,
                    format!("{required} is required"),
                ));
            }
        }
    }
    if object
        .get("colorSchemes")
        .and_then(Value::as_array)
        .is_some_and(|schemes| {
            schemes
                .iter()
                .any(|scheme| !matches!(scheme.as_str(), Some("light" | "dark")))
        })
    {
        issues.push(issue(
            document,
            path,
            "colorSchemes",
            Code::HtmlFrontMatter,
            "colorSchemes must contain only light or dark",
        ));
        if let Some(previous) = object.remove("colorSchemes") {
            discard(previous);
        }
    }
    if let Some(steps) = object.get_mut("steps").and_then(Value::as_array_mut) {
        let mut valid = Vec::new();
        for (index, step) in steps.iter().enumerate() {
            let prefix = format!("steps/{index}");
            let failure = |field: &str, code, message| {
                issue(document, path, &format!("{prefix}/{field}"), code, message)
            };
            let Some(fields) = step.as_object() else {
                issues.push(failure(
                    "",
                    Code::HtmlFrontMatter,
                    format!("step #{} must be an object", index + 1),
                ));
                continue;
            };
            let before = issues.len();
            for field in fields.keys() {
                if !matches!(field.as_str(), "screenPath" | "title" | "description") {
                    issues.push(failure(
                        field,
                        Code::InvalidField,
                        format!("step #{}: unknown field {field}", index + 1),
                    ));
                }
            }
            for field in ["screenPath", "title", "description"] {
                if fields
                    .get(field)
                    .map_or(field == "screenPath", |value| !value.is_string())
                {
                    let location_field = if fields.contains_key(field) {
                        field
                    } else {
                        fields.keys().next().map_or("", String::as_str)
                    };
                    issues.push(failure(
                        location_field,
                        Code::HtmlFrontMatter,
                        format!("step #{}: {field} must be a string", index + 1),
                    ));
                }
            }
            if issues.len() == before {
                valid.push(step.clone());
            }
        }
        discard(Value::Array(std::mem::replace(steps, valid)));
    }
    Ok(issues)
}
