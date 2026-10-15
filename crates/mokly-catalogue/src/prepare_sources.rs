//! Source preparation helpers and canonical catalogue order.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::ModelEntry;

use crate::config_types::ResolvedConfig;
use crate::diagnostic::{Code, Issue};
use crate::discovery::{SourceFile, SourceKind};
use crate::input::ParsedEntry;
use crate::locations::at;
use crate::preparation::PreparedCatalogue;
use crate::template_types::Template;
use crate::{parsing, prepare_entry};

pub(crate) fn append(
    prepared: &mut PreparedCatalogue,
    parsed: ParsedEntry,
    file: &SourceFile,
    config: &ResolvedConfig,
    issues: &mut Vec<Issue>,
) {
    let kind = match file.kind {
        SourceKind::Screen => EntryKind::Screen,
        SourceKind::Component => EntryKind::Component,
        SourceKind::Page => EntryKind::Page,
        SourceKind::UseCase => EntryKind::UseCase,
        _ => EntryKind::Document,
    };
    let source = at(&file.path, &parsed.text, 0);
    if file.kind == SourceKind::Document
        && let Err(issue) = parsing::validate_metadata(&parsed.input, &parsed.document, &file.path)
    {
        issues.push(issue);
        return;
    }
    let schemes = &prepared.model.color_schemes;
    match prepare_entry::prepare(
        &parsed,
        file,
        &config.roots[file.root_index],
        kind,
        source,
        schemes,
    ) {
        Ok((entries, errors)) => {
            let path = entries[0].metadata.path.clone();
            if kind == EntryKind::Document {
                prepared.documents.insert(path.clone(), parsed.body.clone());
            } else if kind != EntryKind::UseCase {
                prepared.templates.insert(
                    path.clone(),
                    Template {
                        source_path: file.path.clone(),
                        source: parsed.text.clone(),
                        body: parsed.body.clone(),
                        body_offset: parsed.body_offset,
                        page: kind == EntryKind::Page,
                    },
                );
            }
            for variant in &parsed.input.variants {
                if let Some(slug) = variant.get("slug").and_then(serde_json::Value::as_str) {
                    prepared.slot_fragments.insert(
                        format!("{path}/{slug}"),
                        prepare_entry::slot_fragments(variant),
                    );
                }
            }
            prepared.model.entries.extend(entries);
            issues.extend(errors);
        }
        Err(issue) => issues.push(issue),
    }
}

pub(crate) fn canonical_order(entries: &mut Vec<ModelEntry>) {
    let mut groups = Vec::new();
    let mut variants = BTreeMap::<String, Vec<ModelEntry>>::new();
    for entry in std::mem::take(entries) {
        if let Some(parent) = &entry.metadata.variant_of {
            variants.entry(parent.clone()).or_default().push(entry);
        } else {
            groups.push(entry);
        }
    }
    groups.sort_by(|a, b| {
        a.content
            .kind()
            .cmp(&b.content.kind())
            .then_with(|| compare_utf16(&a.metadata.path, &b.metadata.path))
    });
    for parent in groups {
        let children = variants.remove(&parent.metadata.path).unwrap_or_default();
        entries.push(parent);
        entries.extend(children);
    }
}

pub(crate) fn duplicate_indices(files: &[SourceFile]) -> Vec<Issue> {
    let mut directories = BTreeMap::<String, String>::new();
    let mut issues = Vec::new();
    for file in files
        .iter()
        .filter(|file| !file.excluded && file.kind == SourceKind::Document)
    {
        let name = file.path.rsplit('/').next().unwrap_or(&file.path);
        if !name.eq_ignore_ascii_case("readme.md") && !name.eq_ignore_ascii_case("index.md") {
            continue;
        }
        let directory = file
            .path
            .rsplit_once('/')
            .map_or("", |(directory, _)| directory)
            .to_owned();
        if let Some(first) = directories.insert(directory.clone(), name.into()) {
            issues.push(Issue::new(
                Code::DuplicateIndex,
                format!("directory {directory} has two index documents: {first} and {name}"),
            ));
        }
    }
    issues
}
