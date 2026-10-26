//! Validate static logical targets before rendering resolves document fragments.

use mokly_model::catalogue::{ModelEntry, SourceLocation};
use pulldown_cmark::{Event, Parser, Tag};

use crate::diagnostic::Issue;
use crate::html_tokens::{self, Token};
use crate::locations::at;
use crate::relationships;
use crate::template_types::{ElementRegistry, Template};

/// A logical destination retains its coordinate before the full source is released.
pub(crate) struct MarkdownTarget {
    value: String,
    location: SourceLocation,
}

pub(crate) fn html(
    template: &Template,
    entry: &ModelEntry,
    entries: &[ModelEntry],
    registry: &ElementRegistry,
) -> Vec<Issue> {
    let mut issues = Vec::new();
    for parsed in html_tokens::parse(template.html()) {
        let Token::StartTag(tag) = parsed.token else {
            continue;
        };
        let element = String::from_utf8_lossy(&tag.name);
        for (name, value) in &tag.attributes {
            let text = String::from_utf8_lossy(&value.value);
            let target = if name.as_slice() == b"href" {
                text.strip_prefix("mock:")
            } else if name.as_slice() == b"to"
                && (matches!(tag.name.as_slice(), b"a" | b"button" | b"div" | b"span")
                    || registry.contains_key(element.as_ref()))
            {
                Some(text.as_ref())
            } else {
                None
            };
            if let Some(target) =
                target.filter(|target| !target.contains("{{") && !target.starts_with('$'))
                && let Some(mut issue) = relationships::link(target, &entry.metadata, entries)
            {
                issue.location = Some(at(
                    &template.source_path,
                    &template.source,
                    template.body_offset + value.span.start,
                ));
                issues.push(issue);
            }
        }
    }
    issues
}

/// Capture link offsets while the original Markdown source is available.
pub(crate) fn markdown(source: &str, body_offset: usize, path: &str) -> Vec<MarkdownTarget> {
    let mut targets = Vec::new();
    for (event, range) in Parser::new(&source[body_offset..]).into_offset_iter() {
        if let Event::Start(Tag::Link { dest_url, .. } | Tag::Image { dest_url, .. }) = event
            && let Some(target) = dest_url.strip_prefix("mock:")
        {
            targets.push(MarkdownTarget {
                value: target.into(),
                location: at(path, source, body_offset + range.start),
            });
        }
    }
    targets
}

/// Resolve captured targets after the complete entry inventory is prepared.
pub(crate) fn markdown_issues(
    targets: &[MarkdownTarget],
    entry: &ModelEntry,
    entries: &[ModelEntry],
) -> Vec<Issue> {
    targets
        .iter()
        .filter_map(|target| {
            relationships::link(&target.value, &entry.metadata, entries)
                .map(|issue| issue.at(target.location.clone()))
        })
        .collect()
}
