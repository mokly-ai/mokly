//! Unified custom-element registrations and component dependency cycles.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::catalogue::{EntryContent, ModelEntry};

use crate::diagnostic::{Code, Issue};
use crate::relationships;
use crate::template_types::{ElementRegistry, RegisteredElement};

pub(crate) fn register(entries: &[ModelEntry]) -> (ElementRegistry, Vec<Issue>) {
    let mut registry = BTreeMap::new();
    let mut issues = Vec::new();
    for entry in entries
        .iter()
        .filter(|entry| entry.metadata.variant_of.is_none())
    {
        let EntryContent::Component {
            visual,
            element: Some(element),
            slots,
            ..
        } = &entry.content
        else {
            continue;
        };
        if !valid_element(element) {
            issues.push(
                Issue::new(
                    if entry.metadata.source.export.is_some() {
                        Code::ComponentElement
                    } else {
                        Code::HtmlElement
                    },
                    format!("invalid or reserved component element {element}"),
                )
                .at(entry.metadata.source.clone()),
            );
            continue;
        }
        if let Some(earlier) = registry.get(element) {
            let earlier: &RegisteredElement = earlier;
            issues.push(
                Issue::new(
                    if entry.metadata.source.export.is_some() {
                        Code::ComponentElement
                    } else {
                        Code::HtmlElement
                    },
                    format!(
                        "component element {element} is registered by {} and {}",
                        earlier.source_path, entry.metadata.source.path
                    ),
                )
                .at(entry.metadata.source.clone()),
            );
            continue;
        }
        registry.insert(
            element.clone(),
            RegisteredElement {
                link_base: relationships::base(&entry.metadata, entries),
                path: entry.metadata.path.clone(),
                source_path: entry.metadata.source.path.clone(),
                prop_schema: visual.prop_schema.clone(),
                slots: slots.clone(),
            },
        );
    }
    (registry, issues)
}

fn valid_element(element: &str) -> bool {
    element
        .bytes()
        .next()
        .is_some_and(|c| c.is_ascii_lowercase())
        && element.contains('-')
        && !element.starts_with("mokly-")
        && element.bytes().all(|c| {
            c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, b'-' | b'_' | b'.')
        })
        && !matches!(
            element,
            "annotation-xml"
                | "color-profile"
                | "font-face"
                | "font-face-src"
                | "font-face-uri"
                | "font-face-format"
                | "font-face-name"
                | "missing-glyph"
        )
}

pub(crate) fn cycles(
    edges: &BTreeMap<String, BTreeSet<String>>,
    entries: &[ModelEntry],
) -> Vec<Issue> {
    let mut done = BTreeSet::new();
    let mut issues = Vec::new();
    for path in edges.keys() {
        visit(
            path,
            edges,
            &mut Vec::new(),
            &mut done,
            &mut issues,
            entries,
        );
    }
    issues
}

fn visit(
    path: &str,
    edges: &BTreeMap<String, BTreeSet<String>>,
    stack: &mut Vec<String>,
    done: &mut BTreeSet<String>,
    issues: &mut Vec<Issue>,
    entries: &[ModelEntry],
) {
    if let Some(index) = stack.iter().position(|ancestor| ancestor == path) {
        let cycle: Vec<_> = stack[index..]
            .iter()
            .map(String::as_str)
            .chain([path])
            .map(|path| {
                entries
                    .iter()
                    .find(|entry| entry.metadata.path == path)
                    .map_or(path, |entry| entry.metadata.source.path.as_str())
            })
            .collect();
        issues.push(Issue::new(
            Code::HtmlElement,
            format!("component cycle: {}", cycle.join(" -> ")),
        ));
        return;
    }
    if !done.insert(path.into()) {
        return;
    }
    stack.push(path.into());
    for child in edges.get(path).into_iter().flatten() {
        visit(child, edges, stack, done, issues, entries);
    }
    stack.pop();
}
