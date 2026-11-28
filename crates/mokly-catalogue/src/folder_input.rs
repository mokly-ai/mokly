//! Strict directory-carried folder records and pre-derivation exclusions.

use std::collections::BTreeSet;

use mokly_model::catalogue::{FolderRecord, SourceLocation};
use mokly_model::paths::is_path_segment;
use serde_json::Value;

use crate::diagnostic::{Code, Issue};
use crate::globs::{self, GlobSyntax};
use crate::locations::{at, json_positions};

/// Private directory carrier retains exclusion rules outside the model.
#[derive(Clone, Debug)]
pub(crate) struct FolderInput {
    pub(crate) record: FolderRecord,
    pub(crate) exclude: Vec<String>,
    top_level_field: Option<(&'static str, SourceLocation)>,
}

impl FolderInput {
    pub(crate) fn at_path(mut self, path: String) -> Result<Self, Issue> {
        if let Some((field, location)) = self.top_level_field.take()
            && path.is_empty()
        {
            return Err(issue(
                &self.record.source.path,
                format!("{field} is not allowed at the top level"),
                location,
            ));
        }
        self.record.path = path;
        Ok(self)
    }
}

pub(crate) fn parse(text: &str, file: &str) -> Result<FolderInput, Issue> {
    let value: Value = match serde_json::from_str(text) {
        Ok(value) => value,
        Err(error) => {
            return Err(issue(
                file,
                format!("invalid JSON: {error}"),
                SourceLocation {
                    path: file.into(),
                    line: error.line(),
                    column: error.column(),
                    export: None,
                },
            ));
        }
    };
    let positions = json_positions(text);
    let location = |field: &str| {
        at(
            file,
            text,
            positions.get(&format!("/{field}")).copied().unwrap_or(0),
        )
    };
    let Some(object) = value.as_object() else {
        return Err(issue(file, "must be a JSON object", location("")));
    };
    let mut top_level_field = None;
    for key in object.keys() {
        let field = match key.as_str() {
            "title" => "title",
            "hidden" => "hidden",
            "order" | "exclude" => continue,
            _ => return Err(issue(file, format!("unknown field {key}"), location(key))),
        };
        top_level_field.get_or_insert_with(|| (field, location(field)));
    }
    let title = if let Some(title) = object.get("title") {
        let Some(title) = title
            .as_str()
            .filter(|title| !title.is_empty() && *title == title.trim())
        else {
            return Err(issue(
                file,
                "title must be a nonempty string without leading or trailing whitespace",
                location("title"),
            ));
        };
        Some(title.into())
    } else {
        None
    };
    let hidden = if let Some(hidden) = object.get("hidden") {
        let Some(hidden) = hidden.as_bool() else {
            return Err(issue(file, "hidden must be a boolean", location("hidden")));
        };
        Some(hidden)
    } else {
        None
    };
    let order = if let Some(value) = object.get("order") {
        let error = || {
            issue(
                file,
                "order must be an array of segments with at most one \"...\" and no duplicates",
                location("order"),
            )
        };
        let Some(items) = value.as_array() else {
            return Err(error());
        };
        let mut order = Vec::new();
        let mut seen = BTreeSet::new();
        for item in items {
            let Some(item) = item
                .as_str()
                .filter(|item| *item == "..." || is_path_segment(item))
            else {
                return Err(error());
            };
            if !seen.insert(item) {
                return Err(error());
            }
            if item == "index" {
                return Err(issue(file, "order cannot name index", location("order")));
            }
            order.push(item.into());
        }
        Some(order)
    } else {
        None
    };
    let exclude = if let Some(value) = object.get("exclude") {
        let Some(items) = value.as_array() else {
            return Err(issue(
                file,
                "exclude must be an array of safe relative globs",
                location("exclude"),
            ));
        };
        let mut exclude = Vec::new();
        for item in items {
            let Some(item) = item.as_str() else {
                return Err(issue(
                    file,
                    "exclude must be an array of safe relative globs",
                    location("exclude"),
                ));
            };
            exclude.push(item.into());
        }
        if globs::compile(&exclude, GlobSyntax::Posix).is_err() {
            return Err(issue(
                file,
                "exclude must be an array of safe relative globs",
                location("exclude"),
            ));
        }
        exclude
    } else {
        Vec::new()
    };
    Ok(FolderInput {
        record: FolderRecord {
            path: String::new(),
            title,
            order,
            hidden,
            source: location(""),
        },
        exclude,
        top_level_field,
    })
}

fn issue(file: &str, reason: impl AsRef<str>, location: SourceLocation) -> Issue {
    Issue::new(Code::InvalidFolder, format!("{file}: {}", reason.as_ref())).at(location)
}
