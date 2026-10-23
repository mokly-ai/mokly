//! Hash only reachable routing records, with conservative coverage for opaque fragments.

use std::collections::BTreeSet;
use std::iter;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::tree::{self, Node};
use mokly_html::{parse, props};
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::routes;
use pulldown_cmark::{Event, Parser, Tag};

use crate::error::Result;
use crate::key::NodeKey;
use crate::routing_records::RoutingRecords;

pub(crate) fn key(
    entry: &ModelEntry,
    components: &BTreeSet<String>,
    catalogue: &PreparedCatalogue,
    records: &RoutingRecords<'_>,
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
        for slot in slots.values() {
            scan(&slot.body, parent, catalogue, &mut targets, &mut opaque);
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
    records.key(targets, opaque)
}

fn scan(
    body: &str,
    source: &str,
    catalogue: &PreparedCatalogue,
    targets: &mut BTreeSet<String>,
    opaque: &mut bool,
) {
    let nodes = parse::fragment(body);
    for node in tree::walk(&nodes) {
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

#[cfg(test)]
#[path = "_tests_/routing_tests.rs"]
mod routing_tests;
