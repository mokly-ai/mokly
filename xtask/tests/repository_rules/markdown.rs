//! Markdown link destinations and the heading anchors that GitHub renders.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use pulldown_cmark::{Event, LinkType, Options, Parser, Tag};
use regex::Regex;

static FENCE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\s*(```|~~~)").unwrap());
static HEADING: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*#{1,6}\s+(.+?)\s*#*\s*$").unwrap());
static TAG: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<[^>]+>").unwrap());
static PUNCTUATION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^\p{L}\p{N}_\-\s]").unwrap());
static WHITESPACE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s").unwrap());
static ANCHOR: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"<a\s+(?:id|name)=["']([^"']+)["']"#).unwrap());

/// The unique link and image destinations of a Markdown text, with every
/// reference definition first, in document order. The GitHub-flavoured
/// parser decides which text is a link, so code spans and code blocks hold
/// none. An email autolink becomes a `mailto:` destination.
pub(crate) fn links(text: &str) -> Vec<String> {
    let options =
        Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TASKLISTS;
    let parser = Parser::new_ext(text, options);
    let mut definitions: Vec<(usize, String)> = parser
        .reference_definitions()
        .iter()
        .map(|(_, definition)| (definition.span.start, definition.dest.to_string()))
        .collect();
    definitions.sort();
    let mut found = Vec::new();
    for (_, destination) in definitions {
        push_unique(&mut found, destination);
    }
    for event in parser {
        let (Event::Start(Tag::Link {
            link_type,
            dest_url,
            ..
        })
        | Event::Start(Tag::Image {
            link_type,
            dest_url,
            ..
        })) = event
        else {
            continue;
        };
        let destination = if link_type == LinkType::Email {
            format!("mailto:{dest_url}")
        } else {
            dest_url.to_string()
        };
        push_unique(&mut found, destination);
    }
    found
}

/// The anchors of a Markdown text: GitHub heading slugs outside fenced code,
/// numbered when repeated, and the `id` or `name` of each HTML anchor.
pub(crate) fn anchors(text: &str) -> HashSet<String> {
    let mut found = HashSet::new();
    let mut repeated = HashMap::new();
    let mut fenced = false;
    for line in text.split('\n') {
        if FENCE.is_match(line) {
            fenced = !fenced;
            continue;
        }
        if fenced {
            continue;
        }
        let Some(heading) = HEADING.captures(line) else {
            continue;
        };
        let slug = heading[1].to_lowercase();
        let slug = TAG.replace_all(&slug, "");
        let slug = PUNCTUATION.replace_all(&slug, "");
        let slug = WHITESPACE.replace_all(slug.trim(), "-").into_owned();
        let count = repeated.entry(slug.clone()).or_insert(0);
        found.insert(if *count == 0 {
            slug.clone()
        } else {
            format!("{slug}-{count}")
        });
        *count += 1;
    }
    for anchor in ANCHOR.captures_iter(text) {
        found.insert(anchor[1].to_owned());
    }
    found
}

fn push_unique(found: &mut Vec<String>, destination: String) {
    if !found.contains(&destination) {
        found.push(destination);
    }
}
