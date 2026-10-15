//! Validate static logical targets before rendering resolves document fragments.

use html5gum::{DefaultEmitter, Token, Tokenizer};
use mokly_model::catalogue::{EntryContent, ModelEntry};
use pulldown_cmark::{Event, Parser, Tag};

use crate::diagnostic::Issue;
use crate::locations::at;
use crate::relationships;
use crate::template_types::{ElementRegistry, Template};

pub(crate) fn html(
    template: &Template,
    entry: &ModelEntry,
    entries: &[ModelEntry],
    registry: &ElementRegistry,
) -> Vec<Issue> {
    let mut issues = Vec::new();
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(true);
    for token in Tokenizer::new_with_emitter(template.body.as_str(), emitter).flatten() {
        let Token::StartTag(tag) = token else {
            continue;
        };
        let element = String::from_utf8_lossy(&tag.name);
        for (name, value) in &tag.attributes {
            let text = String::from_utf8_lossy(&value.value);
            let target = if name.as_ref() == b"href" {
                text.strip_prefix("mock:")
            } else if name.as_ref() == b"to"
                && (matches!(tag.name.as_ref(), b"a" | b"button" | b"div" | b"span")
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

pub(crate) fn markdown(body: &str, entry: &ModelEntry, entries: &[ModelEntry]) -> Vec<Issue> {
    if !matches!(entry.content, EntryContent::Document { .. }) {
        return Vec::new();
    }
    let mut issues = Vec::new();
    for event in Parser::new(body) {
        if let Event::Start(Tag::Link { dest_url, .. } | Tag::Image { dest_url, .. }) = event
            && let Some(target) = dest_url.strip_prefix("mock:")
            && let Some(issue) = relationships::link(target, &entry.metadata, entries)
        {
            issues.push(issue);
        }
    }
    issues
}
