//! Rust file-kind parsing with exact front matter and field attribution.

use std::collections::BTreeSet;

use mokly_model::catalogue::SourceLocation;
use serde::Deserialize;

use crate::diagnostic::{Code, Issue};
use crate::discovery::SourceKind;
use crate::entry_fields;
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
    let mut value = document.clone();
    let issues = entry_fields::validate(&mut value.value, &document, path, kind)?;
    let input: EntryInput = match EntryInput::deserialize(&value.value) {
        Ok(input) => input,
        Err(error) => {
            return Err(Issue::new(Code::HtmlFrontMatter, error.to_string()).at(at(path, &text, 0)));
        }
    };
    validate_metadata(&input, &document, path)?;
    Ok(ParsedEntry {
        input,
        issues,
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
