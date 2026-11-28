//! Document-local replacement of tokens with portable asset paths.

use std::collections::VecDeque;
use std::ops::Range;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_css::paths;
use mokly_html::parse;
use mokly_html::tree::{self, Node};
use mokly_model::material::digest;
use mokly_model::routes;

use crate::asset_base::{self, DocumentAssets};
use crate::error::Result;
use crate::reference_positions::{self, ReferenceKind};

const PREFIX: &str = "mokly-asset:[";

/// Replace portable asset tokens and reject a base that redirects their URLs.
pub(crate) fn rewrite(nodes: &mut [Node], route: &str) -> Result<()> {
    let mut documents = vec![DocumentAssets::default()];
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Element(element) => {
                for attribute in &mut element.attributes {
                    let changes = replacements(&attribute.value, route);
                    if changes.is_empty() {
                        continue;
                    }
                    let output = substitute(&attribute.value, &changes, "");
                    if reference_positions::kind(&element.name, &attribute.name)
                        == Some(ReferenceKind::EmbeddedDocument)
                    {
                        collect_embedded(&attribute.value, &changes, &mut documents);
                    } else {
                        documents[0]
                            .urls
                            .extend(changes.into_iter().map(|change| change.url));
                    }
                    attribute.value = output;
                }
                if let Some(records) = &mut element.style_attribution {
                    for record in records {
                        rewrite_text(&mut record.css, route, &mut documents[0].urls);
                    }
                }
                pending.extend(element.children.iter_mut().rev());
            }
            Node::Region { children, .. } => pending.extend(children.iter_mut().rev()),
            Node::Text(value) => rewrite_text(value, route, &mut documents[0].urls),
            Node::Comment(_) | Node::Doctype(_) => {}
        }
    }
    if documents.iter().all(|document| document.urls.is_empty()) {
        return Ok(());
    }
    documents[0].base = asset_base::first_base_href(nodes).map(str::to_owned);
    asset_base::validate(&documents, route)
}

/// Parse a copy whose markers track which URLs were written into the raw srcdoc text.
fn collect_embedded(source: &str, changes: &[Replacement], documents: &mut Vec<DocumentAssets>) {
    let marker = format!("mokly-written-{}:", digest(source.as_bytes()));
    let mut pending = VecDeque::from([(0, substitute(source, changes, &marker))]);
    while let Some((parent, html)) = pending.pop_front() {
        let nodes = parse::html(DeliveredHtml::document(&html));
        let index = documents.len();
        let mut urls = Vec::new();
        for node in tree::walk(&nodes) {
            match node {
                Node::Element(element) => {
                    for attribute in &element.attributes {
                        if !attribute.value.contains(&marker) {
                            continue;
                        }
                        if reference_positions::kind(&element.name, &attribute.name)
                            == Some(ReferenceKind::EmbeddedDocument)
                        {
                            pending.push_back((index, attribute.value.clone()));
                        } else {
                            urls.extend(written_urls(&attribute.value, &marker).map(str::to_owned));
                        }
                    }
                }
                Node::Text(value) | Node::Comment(value) => {
                    urls.extend(written_urls(value, &marker).map(str::to_owned));
                }
                _ => {}
            }
        }
        documents.push(DocumentAssets {
            parent: Some(parent),
            base: asset_base::first_base_href(&nodes).map(|href| href.replace(&marker, "")),
            urls,
        });
    }
}

fn written_urls<'a>(value: &'a str, marker: &'a str) -> impl Iterator<Item = &'a str> {
    let mut parts = value.split(marker).skip(1);
    std::iter::from_fn(move || {
        let url = parts.next()?;
        parts.next()?;
        Some(url)
    })
}

fn rewrite_text(value: &mut String, route: &str, urls: &mut Vec<String>) {
    let changes = replacements(value, route);
    if !changes.is_empty() {
        *value = substitute(value, &changes, "");
        urls.extend(changes.into_iter().map(|change| change.url));
    }
}

struct Replacement {
    range: Range<usize>,
    url: String,
}

fn replacements(value: &str, route: &str) -> Vec<Replacement> {
    let mut changes = Vec::new();
    let mut rest = value;
    while let Some(start) = rest.find(PREFIX) {
        let offset = value.len() - rest.len();
        let name = &rest[start + PREFIX.len()..];
        let Some(end) = name.find(']') else {
            break;
        };
        let path = &name[..end];
        rest = &name[end + 1..];
        let asset_route = paths::route("assets", path);
        if paths::portable(&asset_route, true) {
            changes.push(Replacement {
                range: offset + start..value.len() - rest.len(),
                url: routes::relative(route, &asset_route),
            });
        }
    }
    changes
}

fn substitute(value: &str, changes: &[Replacement], marker: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut start = 0;
    for change in changes {
        output.push_str(&value[start..change.range.start]);
        output.push_str(marker);
        output.push_str(&change.url);
        output.push_str(marker);
        start = change.range.end;
    }
    output.push_str(&value[start..]);
    output
}

#[cfg(test)]
#[path = "_tests_/asset_tokens_tests.rs"]
mod asset_tokens_tests;
