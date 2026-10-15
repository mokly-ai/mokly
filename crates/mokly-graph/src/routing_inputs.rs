//! Hash only reachable routing records, with conservative coverage for opaque fragments.

use std::collections::BTreeSet;
use std::iter;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::tree::Node;
use mokly_html::{parse, props};
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::routes;
use pulldown_cmark::{Event, Parser, Tag};
use serde_json::json;

use crate::error::Result;
use crate::key::{NodeKey, NodeKind, data_key};

pub(crate) fn key(
    entry: &ModelEntry,
    components: &BTreeSet<String>,
    catalogue: &PreparedCatalogue,
) -> Result<NodeKey> {
    let mut targets = BTreeSet::new();
    let mut opaque = false;
    let parent = entry
        .metadata
        .variant_of
        .as_ref()
        .unwrap_or(&entry.metadata.path);
    for path in iter::once(parent).chain(components) {
        let Some(template) = catalogue.templates.get(path) else {
            opaque |= !matches!(entry.content, EntryContent::Document { .. });
            continue;
        };
        let body = if path == parent {
            match &entry.content {
                EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
                    props::substitute(&template.body, &visual.prop_schema, &visual.props)
                        .unwrap_or_else(|_| template.body.clone())
                }
                _ => template.body.clone(),
            }
        } else {
            template.body.clone()
        };
        scan(&body, path, catalogue, &mut targets, &mut opaque);
    }
    if let Some(slots) = catalogue.slot_fragments.get(&entry.metadata.path) {
        for body in slots.values() {
            scan(body, parent, catalogue, &mut targets, &mut opaque);
        }
    }
    if let Some(body) = catalogue.documents.get(&entry.metadata.path) {
        for event in Parser::new(body) {
            if let Event::Start(Tag::Link { dest_url, .. } | Tag::Image { dest_url, .. }) = event {
                if let Some(logical) = dest_url.strip_prefix("mock:") {
                    target(logical, parent, catalogue, &mut targets);
                } else if let Some(path) = routes::resolve(&entry.metadata.source.path, &dest_url)
                    && let Some(document) = catalogue.model.entries.iter().find(|candidate| {
                        candidate.metadata.source.path == path.split('#').next().unwrap_or(&path)
                    })
                {
                    targets.insert(document.metadata.path.clone());
                }
            }
        }
    }
    if opaque {
        targets.extend(
            catalogue
                .model
                .entries
                .iter()
                .map(|entry| entry.metadata.path.clone()),
        );
    }
    let mut records = Vec::new();
    let mut visited = BTreeSet::new();
    while let Some(path) = targets.pop_first() {
        if !visited.insert(path.to_ascii_lowercase()) {
            continue;
        }
        let found = catalogue.model.entries.iter().find(|entry| {
            entry.metadata.path.eq_ignore_ascii_case(&path)
                || entry
                    .metadata
                    .moved_from
                    .as_deref()
                    .is_some_and(|old| old.eq_ignore_ascii_case(&path))
        });
        let Some(entry) = found else {
            records.push(json!({"missing":path}));
            continue;
        };
        let (schemes, first) = match &entry.content {
            EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
                (visual.color_schemes.clone(), None)
            }
            EntryContent::Document { color_schemes, .. } => (color_schemes.clone(), None),
            EntryContent::UseCase { steps } => {
                (Vec::new(), steps.first().map(|step| &step.screen_path))
            }
            EntryContent::Page => (Vec::new(), None),
        };
        if let Some(first) = first {
            targets.insert(first.clone());
        }
        records.push(json!({"requested":path,"path":entry.metadata.path,"kind":entry.content.kind(),"schemes":schemes,"first":first}));
    }
    data_key(NodeKind::Document, json!(records))
}

fn scan(
    body: &str,
    source: &str,
    catalogue: &PreparedCatalogue,
    targets: &mut BTreeSet<String>,
    opaque: &mut bool,
) {
    let mut nodes = parse::fragment(body);
    while let Some(node) = nodes.pop() {
        if let Node::Element(element) = node {
            for attribute in &element.attributes {
                if matches!(attribute.name.as_str(), "href" | "data-nav-href" | "to")
                    && attribute.value.contains("{{")
                {
                    *opaque = true;
                    continue;
                }
                let logical = if attribute.name == "to" {
                    Some(attribute.value.as_str())
                } else if matches!(attribute.name.as_str(), "href" | "data-nav-href") {
                    attribute.value.strip_prefix("mock:")
                } else {
                    None
                };
                if let Some(logical) = logical {
                    target(logical, source, catalogue, targets);
                }
            }
            nodes.extend(element.children);
        }
    }
}

fn target(
    value: &str,
    source: &str,
    catalogue: &PreparedCatalogue,
    targets: &mut BTreeSet<String>,
) {
    let value = value.split('#').next().unwrap_or(value);
    let metadata = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == source);
    let base = metadata.map_or("", |entry| {
        if entry.metadata.is_index {
            entry.metadata.path.as_str()
        } else {
            entry
                .metadata
                .path
                .rsplit_once('/')
                .map_or("", |(base, _)| base)
        }
    });
    let path = if value.starts_with("./") || value.starts_with("../") {
        routes::resolve(format!("{base}/index.html").trim_start_matches('/'), value)
    } else {
        Some(value.into())
    };
    if let Some(path) = path {
        targets.insert(path);
    }
}
