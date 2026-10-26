//! Authored HTML token boundary with separate diagnostic metadata.

use std::borrow::Cow;
use std::collections::BTreeMap;

use html5gum::{DefaultEmitter, Tokenizer};

use crate::html_token_conversion::own_token;
pub use crate::html_token_types::{
    Doctype, EndTag, Error, ErrorToken, Span, Spanned, StartTag, Token,
};
use crate::template_types::ignore_attribute_allowed;

/// One token and the diagnostics that must survive attribute normalization.
pub struct ParsedToken {
    /// The token visible to template, link, and source-location consumers.
    pub token: Token,
    /// Discarded ignore-wrapper attribute names, without their unevaluated values.
    pub ignored_attributes: Vec<String>,
    /// Whether the original tag supplied reserved navigation metadata.
    pub reserved_navigation: bool,
}

/// Parse authored HTML while retaining token errors and original byte spans.
pub fn parse(source: &str) -> impl Iterator<Item = ParsedToken> + '_ {
    let tokens = expand_markup_contexts(
        source,
        collapse_raw_elements(source, tokenize(source, true)),
    );
    tokens.into_iter().map(normalize)
}

/// Parse one attribute list through the same authored HTML boundary.
pub fn parse_attributes(source: &str) -> Option<BTreeMap<String, String>> {
    let synthetic = format!("<i {source}></i>");
    let mut tags = 0;
    let mut attributes = None;
    for parsed in parse(&synthetic) {
        match parsed.token {
            Token::StartTag(tag)
                if tags == 0 && tag.name.as_slice() == b"i" && !tag.self_closing =>
            {
                tags += 1;
                attributes = Some(
                    tag.attributes
                        .into_iter()
                        .map(|(name, value)| {
                            (
                                String::from_utf8_lossy(&name).into_owned(),
                                String::from_utf8_lossy(&value.value).into_owned(),
                            )
                        })
                        .collect(),
                );
            }
            Token::EndTag(tag) if tags == 1 && tag.name.as_slice() == b"i" => tags += 1,
            Token::Error(_) => return None,
            _ => return None,
        }
    }
    attributes.filter(|_| tags == 2)
}

fn tokenize(source: &str, switch_states: bool) -> Vec<html5gum::Token<usize>> {
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(switch_states);
    Tokenizer::new_with_emitter(source, emitter)
        .flatten()
        .collect()
}

fn collapse_raw_elements(
    source: &str,
    tokens: Vec<html5gum::Token<usize>>,
) -> Vec<html5gum::Token<usize>> {
    let mut output = Vec::new();
    let mut index = 0;
    while index < tokens.len() {
        let html5gum::Token::StartTag(start) = &tokens[index] else {
            output.push(tokens[index].clone());
            index += 1;
            continue;
        };
        if start.name.as_ref() != b"noframes" {
            output.push(tokens[index].clone());
            index += 1;
            continue;
        }
        output.push(tokens[index].clone());
        let mut end_index = index + 1;
        while end_index < tokens.len() {
            if let html5gum::Token::EndTag(end) = &tokens[end_index]
                && end.name.as_ref() == b"noframes"
            {
                break;
            }
            end_index += 1;
        }
        if end_index < tokens.len() {
            let end = match &tokens[end_index] {
                html5gum::Token::EndTag(end) => end.span,
                _ => unreachable!(),
            };
            if let Some(text) = source.get(start.span.end..end.start) {
                output.push(html5gum::Token::String(html5gum::Spanned {
                    value: text.as_bytes().to_vec().into(),
                    span: html5gum::Span {
                        start: start.span.end,
                        end: end.start,
                    },
                }));
            }
            output.push(tokens[end_index].clone());
            index = end_index + 1;
        } else {
            index += 1;
        }
    }
    output
}

fn expand_markup_contexts(
    source: &str,
    tokens: Vec<html5gum::Token<usize>>,
) -> Vec<html5gum::Token<usize>> {
    let mut output = Vec::new();
    let mut foreign_stack = Vec::new();
    let mut raw_context: Option<(Vec<u8>, bool)> = None;
    for token in tokens {
        match &token {
            html5gum::Token::StartTag(tag) => {
                let name = tag.name.as_ref();
                let in_foreign = foreign_stack.last().is_some_and(ContextFrame::is_foreign);
                let integration = in_foreign && is_integration_point(name);
                if !tag.self_closing {
                    if integration {
                        foreign_stack.push(ContextFrame::Integration(name.to_owned()));
                    } else if in_foreign || matches!(name, b"svg" | b"math") {
                        foreign_stack.push(ContextFrame::Foreign(name.to_owned()));
                    } else if foreign_stack.last().is_some_and(ContextFrame::is_html) {
                        foreign_stack.push(ContextFrame::Html(name.to_owned()));
                    }
                }
                let markup_context = (name == b"noscript" && !in_foreign)
                    || (in_foreign && !integration && matches!(name, b"style" | b"title"));
                let raw_context_tag = in_foreign
                    && !integration
                    && matches!(
                        name,
                        b"textarea"
                            | b"xmp"
                            | b"iframe"
                            | b"noembed"
                            | b"noframes"
                            | b"plaintext"
                            | b"script"
                    );
                if name == b"noframes" && !in_foreign {
                    raw_context = Some((name.to_owned(), false));
                } else if markup_context {
                    raw_context = Some((name.to_owned(), true));
                } else if raw_context_tag {
                    raw_context = Some((name.to_owned(), false));
                }
                output.push(token);
            }
            html5gum::Token::String(text) if raw_context.is_some() => {
                let (_, markup) = raw_context.as_ref().unwrap();
                if *markup {
                    let value = source
                        .get(text.span.start..text.span.end)
                        .map(Cow::Borrowed)
                        .unwrap_or_else(|| {
                            Cow::Owned(String::from_utf8_lossy(&text.value).into_owned())
                        });
                    output.extend(
                        expand_markup_contexts(value.as_ref(), tokenize(value.as_ref(), true))
                            .into_iter()
                            .map(|token| shift_token(token, text.span.start)),
                    );
                } else {
                    output.push(token);
                }
            }
            html5gum::Token::EndTag(tag) => {
                if raw_context
                    .as_ref()
                    .is_some_and(|(name, _)| name.as_slice() == tag.name.as_ref())
                {
                    raw_context = None;
                }
                if let Some(index) = foreign_stack
                    .iter()
                    .rposition(|frame| frame.name() == tag.name.as_ref())
                {
                    foreign_stack.truncate(index);
                }
                output.push(token);
            }
            _ => output.push(token),
        }
    }
    output
}

enum ContextFrame {
    Foreign(Vec<u8>),
    Integration(Vec<u8>),
    Html(Vec<u8>),
}

impl ContextFrame {
    fn name(&self) -> &[u8] {
        match self {
            Self::Foreign(name) | Self::Integration(name) | Self::Html(name) => name,
        }
    }

    fn is_foreign(&self) -> bool {
        matches!(self, Self::Foreign(_))
    }

    fn is_html(&self) -> bool {
        matches!(self, Self::Integration(_) | Self::Html(_))
    }
}

fn is_integration_point(name: &[u8]) -> bool {
    matches!(
        name,
        b"foreignobject" | b"mi" | b"mo" | b"mn" | b"ms" | b"mtext"
    )
}

fn shift_token(mut token: html5gum::Token<usize>, offset: usize) -> html5gum::Token<usize> {
    let offset = offset as isize;
    match &mut token {
        html5gum::Token::StartTag(html5gum::StartTag {
            span, attributes, ..
        }) => {
            *span = shift_span(*span, offset);
            for value in attributes.values_mut() {
                value.span = shift_span(value.span, offset);
            }
        }
        html5gum::Token::EndTag(tag) => tag.span = shift_span(tag.span, offset),
        html5gum::Token::String(text) | html5gum::Token::Comment(text) => {
            text.span = shift_span(text.span, offset)
        }
        html5gum::Token::Doctype(doctype) => doctype.span = shift_span(doctype.span, offset),
        html5gum::Token::Error(error) => error.span = shift_span(error.span, offset),
    }
    token
}

fn shift_span(span: html5gum::Span<usize>, offset: isize) -> html5gum::Span<usize> {
    html5gum::Span {
        start: span.start.saturating_add_signed(offset),
        end: span.end.saturating_add_signed(offset),
    }
}

fn normalize(mut token: html5gum::Token<usize>) -> ParsedToken {
    let reserved_navigation = matches!(
        &token,
        html5gum::Token::StartTag(tag) if tag.attributes.keys().any(|name| reserved_navigation_attribute(name))
    );
    let mut ignored_attributes = Vec::new();
    if let html5gum::Token::StartTag(tag) = &mut token {
        let element = String::from_utf8_lossy(&tag.name);
        tag.attributes.retain(|name, _| {
            let name = String::from_utf8_lossy(name);
            if ignore_attribute_allowed(&element, &name) {
                true
            } else {
                ignored_attributes.push(name.into_owned());
                false
            }
        });
    }
    ParsedToken {
        token: own_token(token),
        ignored_attributes,
        reserved_navigation,
    }
}

/// Format one ignore-wrapper attribute warning with reserved metadata wording.
pub(crate) fn ignore_warning_message(attribute: &str, tag: &[u8]) -> String {
    let (label, ending) = if reserved_navigation_attribute(attribute.as_bytes()) {
        ("reserved navigation metadata", "is rejected")
    } else {
        ("unknown attribute", "is ignored")
    };
    format!(
        "{label} {attribute} on <{}> {ending}",
        String::from_utf8_lossy(tag)
    )
}

/// Navigation attributes that authored markup cannot supply, including future control fields.
pub fn reserved_navigation_attribute(name: &[u8]) -> bool {
    name == b"data-mokly-link" || name.starts_with(b"data-mokly-link-control")
}
