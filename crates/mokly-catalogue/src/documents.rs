//! Markdown metadata and title extraction; document rendering belongs to composition.

use std::collections::BTreeMap;

use mokly_model::paths::title_from_slug;
use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
use serde_json::{Map, Value};

use crate::diagnostic::{Code, Issue};
use crate::front_matter;
use crate::input::{EntryInput, ParsedEntry};
use crate::locations::at;
use crate::yaml::Document;

pub(crate) fn parse(text: String, path: &str) -> Result<ParsedEntry, Issue> {
    let block = front_matter::split(&text, path, false)?;
    let mut object = Map::new();
    let mut positions = BTreeMap::new();
    if let Some(header) = block.header {
        let header_offset = text.find('\n').map_or(text.len(), |offset| offset + 1);
        let mut offset = header_offset;
        for (index, line) in header.lines().enumerate() {
            let location = at(path, &text, offset);
            let failure = |reason: String| {
                Issue::new(
                    Code::DocumentFrontMatter,
                    format!("{path}: front matter {reason}"),
                )
                .at(location.clone())
            };
            let Some((key, raw)) = line
                .split_once(':')
                .filter(|(key, _)| !key.is_empty() && !key.chars().any(char::is_whitespace))
            else {
                return Err(failure(format!("line {} is not \"key: value\"", index + 2)));
            };
            if !matches!(key, "title" | "description" | "tags" | "path" | "movedFrom") {
                return Err(failure(format!("unknown field {key}")));
            }
            if object.contains_key(key) {
                return Err(failure(format!("repeated field {key}")));
            }
            let raw = raw.trim();
            let value = if raw.starts_with(['"', '[', '{']) {
                match serde_json::from_str::<Value>(raw) {
                    Ok(value) => value,
                    Err(_) => return Err(failure(type_reason(key))),
                }
            } else {
                Value::String(raw.into())
            };
            if (key == "tags"
                && !value
                    .as_array()
                    .is_some_and(|values| values.iter().all(Value::is_string)))
                || (key != "tags" && !value.is_string())
            {
                return Err(failure(type_reason(key)));
            }
            object.insert(key.into(), value);
            positions.insert(format!("/{key}"), location);
            offset += line.len() + if header.contains("\r\n") { 2 } else { 1 };
        }
    }
    let body = block.body.to_owned();
    let body_offset = block.body_offset;
    let title = object
        .get("title")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .or_else(|| heading(&body))
        .unwrap_or_else(|| {
            let basename = path
                .rsplit('/')
                .next()
                .unwrap_or(path)
                .split('.')
                .next()
                .unwrap_or(path);
            title_from_slug(basename)
        });
    object.insert("title".into(), Value::String(title));
    let value = Value::Object(object);
    let input: EntryInput = match serde_json::from_value(value.clone()) {
        Ok(input) => input,
        Err(error) => {
            return Err(Issue::new(
                Code::DocumentFrontMatter,
                format!("{path}: front matter {error}"),
            )
            .at(at(path, &text, 0)));
        }
    };
    Ok(ParsedEntry {
        input,
        document: Document { value, positions },
        body,
        body_offset,
        text,
    })
}

fn type_reason(key: &str) -> String {
    format!(
        "{key} must be {}",
        if key == "tags" {
            "an array of strings"
        } else {
            "a string"
        }
    )
}

fn heading(body: &str) -> Option<String> {
    let mut active = false;
    let mut text = String::new();
    for event in Parser::new_ext(
        body,
        Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TASKLISTS,
    ) {
        match event {
            Event::Start(Tag::Heading { .. }) => {
                active = true;
                text.clear();
            }
            Event::End(TagEnd::Heading(_)) => {
                if !text.trim().is_empty() {
                    return Some(text.trim().into());
                }
                active = false;
            }
            Event::Text(value)
            | Event::Code(value)
            | Event::Html(value)
            | Event::InlineHtml(value)
                if active =>
            {
                text.push_str(&value)
            }
            Event::SoftBreak | Event::HardBreak if active => text.push(' '),
            _ => {}
        }
    }
    None
}

#[cfg(test)]
#[path = "_tests_/document_metadata_tests.rs"]
mod document_metadata_tests;
