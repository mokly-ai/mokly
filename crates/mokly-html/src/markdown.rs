//! Safe CommonMark/GFM rendering with injected repository link resolution.

use std::collections::BTreeSet;

use mokly_model::axes::ColorScheme;
use pulldown_cmark::{CowStr, Event, Options, Parser, Tag, TagEnd, html};

use crate::error::Result;
use crate::tree::{Node, element};
use crate::{assembly, autolinks, parse};

/// Repository-aware classification of a Markdown link or image.
#[derive(Clone, Debug)]
pub enum Destination {
    /// A document or another catalogue entry.
    Logical(String),
    /// A portable public resource or permitted external URL.
    Url(String),
    /// A private source reference, rendered as its label only.
    Text,
}

/// Markdown destinations resolve from the source file, before HTML rendering.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = LinkResolverMock))]
pub trait LinkResolver: Send + Sync {
    /// Check and classify one decoded source destination.
    fn resolve(&self, destination: &str) -> Result<Destination>;
    /// Resolve with the source-relative byte position of the authored link.
    fn resolve_at(&self, destination: &str, _offset: usize) -> Result<Destination> {
        self.resolve(destination)
    }
}

/// Render one Markdown document with its owned template and inline stylesheet.
pub fn render(
    body: &str,
    title: &str,
    scheme: ColorScheme,
    resolver: &dyn LinkResolver,
) -> Result<Vec<Node>> {
    let options =
        Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TASKLISTS;
    let (events, spans): (Vec<_>, Vec<_>) =
        Parser::new_ext(body, options).into_offset_iter().unzip();
    let mut rewritten = Vec::new();
    let mut ids = BTreeSet::new();
    let mut links = Vec::new();
    let mut code = false;
    for (index, event) in events.iter().cloned().enumerate() {
        match event {
            Event::Html(text) | Event::InlineHtml(text) => rewritten.push(Event::Text(text)),
            Event::Start(Tag::CodeBlock(kind)) => {
                code = true;
                rewritten.push(Event::Start(Tag::CodeBlock(kind)));
            }
            Event::End(TagEnd::CodeBlock) => {
                code = false;
                rewritten.push(Event::End(TagEnd::CodeBlock));
            }
            Event::Text(text) if !code && links.is_empty() => {
                rewritten.extend(autolinks::events(&text))
            }
            Event::Start(Tag::Heading { level, .. }) => {
                let text: String = events[index + 1..]
                    .iter()
                    .take_while(|event| !matches!(event, Event::End(TagEnd::Heading(_))))
                    .filter_map(|event| match event {
                        Event::Text(text) | Event::Code(text) => Some(text.as_ref()),
                        Event::SoftBreak | Event::HardBreak => Some(" "),
                        _ => None,
                    })
                    .collect();
                let slug: String = text
                    .to_lowercase()
                    .chars()
                    .filter_map(|c| {
                        if c.is_alphanumeric() || c == '_' || c == '-' {
                            Some(c)
                        } else if c.is_whitespace() {
                            Some('-')
                        } else {
                            None
                        }
                    })
                    .collect();
                let mut id = slug.clone();
                let mut suffix = 2;
                while !id.is_empty() && ids.contains(&id) {
                    id = format!("{slug}-{suffix}");
                    suffix += 1;
                }
                let id = if id.is_empty() {
                    None
                } else {
                    ids.insert(id.clone());
                    Some(CowStr::from(id))
                };
                rewritten.push(Event::Start(Tag::Heading {
                    level,
                    id,
                    classes: Vec::new(),
                    attrs: Vec::new(),
                }));
            }
            Event::Start(Tag::Link {
                link_type,
                dest_url,
                title,
                id,
            })
            | Event::Start(Tag::Image {
                link_type,
                dest_url,
                title,
                id,
            }) => {
                let image = matches!(&events[index], Event::Start(Tag::Image { .. }));
                let destination = resolver.resolve_at(&dest_url, spans[index].start)?;
                let logical = matches!(destination, Destination::Logical(_));
                let destination = match destination {
                    Destination::Logical(url) | Destination::Url(url) => Some(CowStr::from(url)),
                    Destination::Text => None,
                };
                links.push((destination.is_some(), image && !logical));
                if let Some(dest_url) = destination {
                    rewritten.push(Event::Start(if image && !logical {
                        Tag::Image {
                            link_type,
                            dest_url,
                            title,
                            id,
                        }
                    } else {
                        Tag::Link {
                            link_type,
                            dest_url,
                            title,
                            id,
                        }
                    }));
                }
            }
            Event::End(TagEnd::Link | TagEnd::Image) => {
                if let Some((true, image)) = links.pop() {
                    rewritten.push(Event::End(if image { TagEnd::Image } else { TagEnd::Link }));
                }
            }
            event => rewritten.push(event),
        }
    }
    let mut html_body = String::new();
    html::push_html(&mut html_body, rewritten.into_iter());
    let mut rendered = parse::fragment(&html_body);
    table_alignment(&mut rendered);
    let mut document = assembly::document(
        title,
        scheme,
        &[],
        &[],
        vec![element("main", &[], rendered)],
    );
    if let Some(Node::Element(root)) = document.get_mut(1) {
        root.set("lang", "en");
        if let Some(Node::Element(head)) = root.children.first_mut() {
            head.children
                .push(element("style", &[], vec![Node::Text(STYLES.into())]));
        }
    }
    Ok(document)
}

fn table_alignment(nodes: &mut [Node]) {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            if matches!(element.name.as_str(), "th" | "td")
                && let Some(style) = element.take("style")
                && let Some(alignment) = style.strip_prefix("text-align: ")
                && matches!(alignment, "left" | "center" | "right")
            {
                element.set("align", alignment);
            }
            pending.extend(element.children.iter_mut().rev());
        }
    }
}

pub(crate) const STYLES: &str = include_str!("document.css");
