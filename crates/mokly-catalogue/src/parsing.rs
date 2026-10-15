//! Rust file-kind parsing with exact front matter and field attribution.

use std::collections::BTreeSet;

use mokly_model::catalogue::SourceLocation;
use serde_json::Value;

use crate::diagnostic::{Code, Issue};
use crate::discovery::SourceKind;
use crate::front_matter;
use crate::input::{EntryInput, ParsedEntry};
use crate::locations::at;
use crate::yaml::{self, Document};

pub(crate) fn parse(text: String, path: &str, kind: SourceKind) -> Result<ParsedEntry, Issue> {
    let (document, body, body_offset) = if kind == SourceKind::UseCase {
        (
            yaml::parse(text.strip_prefix('\u{feff}').unwrap_or(&text), path, 1)?,
            String::new(),
            text.len(),
        )
    } else {
        let block = front_matter::split(&text, path, true)?;
        let document = yaml::parse(block.header.unwrap_or(""), path, 2)?;
        (document, block.body.to_owned(), block.body_offset)
    };
    let Some(object) = document.value.as_object() else {
        return Err(issue(
            &document,
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
                &document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("unknown field {key}"),
            ));
        }
    }
    for key in [
        "title",
        "description",
        "path",
        "movedFrom",
        "rationale",
        "address",
        "element",
    ] {
        if let Some(value) = object.get(key)
            && !value.is_string()
        {
            return Err(issue(
                &document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be a string"),
            ));
        }
    }
    for key in [
        "tags",
        "relatedDocs",
        "useCasePaths",
        "colorSchemes",
        "slots",
    ] {
        if let Some(value) = object.get(key)
            && !value
                .as_array()
                .is_some_and(|list| list.iter().all(Value::is_string))
        {
            return Err(issue(
                &document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be an array of strings"),
            ));
        }
    }
    for key in ["props", "propSchema"] {
        if let Some(value) = object.get(key)
            && !value.is_object()
        {
            return Err(issue(
                &document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be an object"),
            ));
        }
    }
    for key in ["variants", "steps"] {
        if let Some(value) = object.get(key)
            && !value.is_array()
        {
            return Err(issue(
                &document,
                path,
                key,
                Code::HtmlFrontMatter,
                format!("{key} must be an array"),
            ));
        }
    }
    if kind == SourceKind::Component {
        for required in ["element", "propSchema"] {
            if !object.contains_key(required) {
                return Err(issue(
                    &document,
                    path,
                    required,
                    Code::HtmlFrontMatter,
                    format!("{required} is required"),
                ));
            }
        }
    }
    if let Some(steps) = object.get("steps").and_then(Value::as_array) {
        for (index, step) in steps.iter().enumerate() {
            let Some(step) = step.as_object() else {
                return Err(issue(
                    &document,
                    path,
                    "steps",
                    Code::HtmlFrontMatter,
                    format!("step #{} must be an object", index + 1),
                ));
            };
            for key in step.keys() {
                if !matches!(key.as_str(), "screenPath" | "title" | "description") {
                    return Err(issue(
                        &document,
                        path,
                        &format!("steps/{index}/{key}"),
                        Code::InvalidField,
                        format!("step #{}: unknown field {key}", index + 1),
                    ));
                }
            }
        }
    }
    let input: EntryInput = match serde_json::from_value(document.value.clone()) {
        Ok(input) => input,
        Err(error) => {
            return Err(Issue::new(Code::HtmlFrontMatter, error.to_string()).at(at(path, &text, 0)));
        }
    };
    validate_metadata(&input, &document, path)?;
    Ok(ParsedEntry {
        input,
        document,
        body,
        body_offset,
        text,
    })
}

pub(crate) fn validate_metadata(
    input: &EntryInput,
    document: &Document,
    path: &str,
) -> Result<(), Issue> {
    if input.title.is_empty() || input.title.trim() != input.title {
        return Err(issue(
            document,
            path,
            "title",
            Code::HtmlFrontMatter,
            "title must be a nonempty string without leading or trailing whitespace",
        ));
    }
    let mut seen = BTreeSet::new();
    if input
        .tags
        .iter()
        .any(|tag| !valid_tag(tag) || !seen.insert(tag))
    {
        return Err(issue(
            document,
            path,
            "tags",
            Code::HtmlFrontMatter,
            "tags must be an array of unique lowercase kebab-case tags",
        ));
    }
    Ok(())
}

pub(crate) fn valid_tag(value: &str) -> bool {
    value.split('-').all(|part| {
        !part.is_empty()
            && part
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
    })
}

pub(crate) fn issue(
    document: &Document,
    file: &str,
    field: &str,
    code: Code,
    message: impl Into<String>,
) -> Issue {
    let mut pointer = format!("/{field}");
    let location = loop {
        if let Some(location) = document.positions.get(&pointer) {
            break location.clone();
        }
        if let Some((parent, _)) = pointer.rsplit_once('/') {
            pointer = parent.into();
        } else {
            break SourceLocation {
                path: file.into(),
                line: 1,
                column: 1,
                export: None,
            };
        }
    };
    Issue::new(code, message).at(location)
}
