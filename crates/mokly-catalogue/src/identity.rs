//! Path derivation, index collapse, and catalogue-wide identity collisions.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::{ModelEntry, SourceLocation};
use mokly_model::paths::{is_entry_path, is_path_segment};
use serde_json::Value;

use crate::config_types::ResolvedRoot;
use crate::diagnostic::{Code, Issue};
use crate::discovery::{SourceFile, SourceKind};
use crate::input::EntryInput;

pub(crate) fn folder_path(root: &ResolvedRoot, directory: &Path) -> String {
    let mut segments = Vec::new();
    if let Some(prefix) = &root.input.path {
        segments.push(prefix.clone());
    }
    let relative = directory.strip_prefix(&root.directory).unwrap_or(directory);
    for part in relative.components() {
        let name = part.as_os_str().to_string_lossy();
        if !root
            .input
            .transparent
            .iter()
            .flatten()
            .any(|transparent| transparent == name.as_ref())
        {
            segments.push(name.into_owned());
        }
    }
    segments.join("/")
}

pub(crate) fn derive(
    input: &EntryInput,
    file: &SourceFile,
    root: &ResolvedRoot,
    source: &SourceLocation,
) -> Result<(String, bool), Issue> {
    let name = file
        .absolute
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let suffix = match file.kind {
        SourceKind::Screen => ".screen.html",
        SourceKind::Component => ".component.html",
        SourceKind::Page => ".page.html",
        SourceKind::UseCase => ".use-case.yaml",
        _ => "",
    };
    let leaf = input.slug.clone().unwrap_or_else(|| {
        if suffix.is_empty() {
            name.split('.').next().unwrap_or("").into()
        } else {
            name.strip_suffix(suffix).unwrap_or(name).into()
        }
    });
    let is_index = if file.kind == SourceKind::Document {
        name.eq_ignore_ascii_case("readme.md") || name.eq_ignore_ascii_case("index.md")
    } else {
        leaf == "index"
    };
    if let Some(slug) = &input.slug {
        segment(slug, "slug", source)?;
    }
    if let Some(path) = &input.path {
        if !is_entry_path(path) {
            return Err(invalid_path(path, "path", source));
        }
        return Ok((path.clone(), is_index));
    }
    if !is_index {
        segment(&leaf, "file name", source)?;
    }
    let directory = file.absolute.parent().unwrap_or(&root.directory);
    let path = folder_path(root, directory);
    for segment_name in path.split('/').filter(|name| !name.is_empty()) {
        segment(segment_name, "directory name", source)?;
    }
    let path = if is_index {
        path
    } else if path.is_empty() {
        leaf
    } else {
        format!("{path}/{leaf}")
    };
    if path.is_empty() {
        return Err(Issue::new(
            Code::RootIndex,
            format!(
                "{} has no folder to be the index of; give it a path",
                location(source)
            ),
        )
        .at(source.clone()));
    }
    if !is_entry_path(&path) {
        return Err(invalid_path(&path, "path", source));
    }
    Ok((path, is_index))
}

pub(crate) fn segment(value: &str, field: &str, source: &SourceLocation) -> Result<(), Issue> {
    if is_path_segment(value) {
        Ok(())
    } else {
        Err(Issue::new(Code::InvalidSegment, format!("{}: {field} {} is not a valid path segment; use letters, digits, hyphens and underscores", location(source), Value::String(value.into()))).at(source.clone()))
    }
}

pub(crate) fn invalid_path(value: &str, field: &str, source: &SourceLocation) -> Issue {
    Issue::new(
        Code::InvalidPath,
        format!(
            "{}: {field} {} is not a valid path",
            location(source),
            Value::String(value.into())
        ),
    )
    .at(source.clone())
}

pub(crate) fn location(source: &SourceLocation) -> String {
    match &source.export {
        Some(name) => format!("{} export {name}", source.path),
        None => source.path.clone(),
    }
}

pub(crate) fn collisions(entries: &[ModelEntry]) -> Vec<Issue> {
    let mut issues = Vec::new();
    let mut paths: BTreeMap<String, Vec<&ModelEntry>> = BTreeMap::new();
    for entry in entries {
        paths
            .entry(entry.metadata.path.to_ascii_lowercase())
            .or_default()
            .push(entry);
    }
    for group in paths.values().filter(|group| group.len() > 1) {
        let first = &group[0].metadata.path;
        let second = group.iter().find(|entry| entry.metadata.path != *first);
        let (code, message) = match second {
            Some(second) => (
                Code::CaseCollision,
                format!(
                    "paths {first} and {} differ only by letter case:",
                    second.metadata.path
                ),
            ),
            None => (
                Code::DuplicatePath,
                format!("path {first} is defined twice:"),
            ),
        };
        issues.push(list(
            code,
            message,
            group
                .iter()
                .map(|entry| location(&entry.metadata.source))
                .collect(),
        ));
    }
    let by_path: BTreeMap<_, _> = entries
        .iter()
        .map(|entry| (entry.metadata.path.as_str(), entry))
        .collect();
    let mut folders: BTreeMap<String, (&str, &ModelEntry)> = BTreeMap::new();
    let mut reported = std::collections::BTreeSet::new();
    for entry in entries {
        let mut prefix = entry.metadata.path.as_str();
        while let Some((parent, _)) = prefix.rsplit_once('/') {
            let lower = parent.to_ascii_lowercase();
            if let Some((spelling, earlier)) = folders.get(&lower) {
                if *spelling != parent && reported.insert(lower.clone()) {
                    issues.push(list(
                        Code::CaseCollision,
                        format!("paths {spelling} and {parent} differ only by letter case:"),
                        vec![
                            location(&earlier.metadata.source),
                            location(&entry.metadata.source),
                        ],
                    ));
                }
            } else {
                folders.insert(lower, (parent, entry));
            }
            if let Some(owner) = by_path.get(parent) {
                let valid_variant = entry.metadata.variant_of.as_deref() == Some(parent);
                if !owner.metadata.is_index && !valid_variant && reported.insert(parent.to_owned())
                {
                    issues.push(list(
                        Code::DuplicatePath,
                        format!("path {parent} is defined twice:"),
                        vec![
                            location(&owner.metadata.source),
                            location(&entry.metadata.source),
                        ],
                    ));
                }
            }
            prefix = parent;
        }
    }
    issues
}

pub(crate) fn list(code: Code, heading: String, mut locations: Vec<String>) -> Issue {
    locations.sort_by(|a, b| compare_utf16(a, b));
    Issue::new(
        code,
        format!(
            "{heading}\n{}",
            locations
                .into_iter()
                .map(|location| format!("  {location}"))
                .collect::<Vec<_>>()
                .join("\n")
        ),
    )
}
