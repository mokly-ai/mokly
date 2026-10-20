//! Associate authored tags with tree nodes without inventing locations for implied nodes.

use std::collections::{BTreeMap, VecDeque};

use html5gum::Token;
use mokly_catalogue::html_tokens;
use mokly_catalogue::template_types::Template;
use mokly_model::catalogue::SourceLocation;

use crate::error::Result;
use crate::tree::{Element, Node};
use crate::{parse, source_checks};

pub(crate) fn template(template: &Template) -> Result<Vec<Node>> {
    source_checks::validate(&template.body, false)?;
    let mut locations: BTreeMap<String, VecDeque<SourceLocation>> = BTreeMap::new();
    let mut cursor = template.source.char_indices().peekable();
    let (mut line, mut column) = (1, 1);
    for parsed in html_tokens::parse(&template.body) {
        if let Token::StartTag(tag) = parsed.token {
            let name = String::from_utf8_lossy(&tag.name);
            let attributes: BTreeMap<_, _> = tag
                .attributes
                .iter()
                .map(|(name, value)| {
                    (
                        String::from_utf8_lossy(name).into_owned(),
                        String::from_utf8_lossy(&value.value).into_owned(),
                    )
                })
                .collect();
            let key = format!("{name}:{attributes:?}");
            let end = (template.body_offset + tag.span.start).min(template.source.len());
            while cursor.peek().is_some_and(|(index, _)| *index < end) {
                if let Some((_, character)) = cursor.next() {
                    if character == '\n' {
                        line += 1;
                        column = 1;
                    } else {
                        column += 1;
                    }
                }
            }
            locations.entry(key).or_default().push_back(SourceLocation {
                path: template.source_path.clone(),
                line,
                column,
                export: None,
            });
        }
    }
    let mut nodes = if template.page {
        parse::document(&template.body)
    } else {
        parse::fragment(&template.body)
    };
    attach(&mut nodes, &mut locations);
    Ok(nodes)
}

fn attach(nodes: &mut [Node], locations: &mut BTreeMap<String, VecDeque<SourceLocation>>) {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            let key = signature(element);
            element.source = locations.get_mut(&key).and_then(VecDeque::pop_front);
            element.origin = element
                .source
                .as_ref()
                .map(|source| format!("{}:{}:{}", source.path, source.line, source.column));
            pending.extend(element.children.iter_mut().rev());
        }
    }
}

fn signature(element: &Element) -> String {
    let attributes: BTreeMap<_, _> = element
        .attributes
        .iter()
        .map(|attribute| (attribute.name.clone(), attribute.value.clone()))
        .collect();
    format!("{}:{attributes:?}", element.name)
}

pub(crate) fn slot(body: &str, entry: &str, name: &str) -> Vec<Node> {
    let mut nodes = parse::fragment(body);
    let mut next = 0;
    slot_origins(&mut nodes, &format!("saved-slot:{entry}:{name}"), &mut next);
    nodes
}

fn slot_origins(nodes: &mut [Node], prefix: &str, next: &mut usize) {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            element.origin = Some(format!("{prefix}:{}", *next));
            *next += 1;
            pending.extend(element.children.iter_mut().rev());
        }
    }
}
