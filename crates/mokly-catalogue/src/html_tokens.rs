//! Authored HTML token boundary with separate diagnostic metadata.

use std::borrow::Cow;
use std::collections::BTreeMap;

use html5gum::{DefaultEmitter, Span, Spanned, StartTag, Token, Tokenizer};
use mokly_model::material;

use crate::template_types::ignore_attribute_allowed;

/// One token and the diagnostics that must survive attribute normalization.
pub struct ParsedToken {
    /// The token visible to template, link, and source-location consumers.
    pub token: Token<usize>,
    /// Discarded ignore-wrapper attribute names, without their unevaluated values.
    pub ignored_attributes: Vec<String>,
    /// Whether the original tag supplied reserved navigation metadata.
    pub reserved_navigation: bool,
    /// Opaque original wrapper identity for source matching, without discarded values.
    pub source_signature: Option<String>,
}

/// Parse authored HTML while retaining token errors and original byte spans.
pub fn parse(source: &str) -> impl Iterator<Item = ParsedToken> + '_ {
    let tokens = expand_markup_contexts(
        source,
        collapse_raw_elements(source, tokenize(source, true)),
    );
    tokens.into_iter().map(normalize)
}

fn tokenize(source: &str, switch_states: bool) -> Vec<Token<usize>> {
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(switch_states);
    Tokenizer::new_with_emitter(source, emitter)
        .flatten()
        .collect()
}

fn collapse_raw_elements(source: &str, tokens: Vec<Token<usize>>) -> Vec<Token<usize>> {
    let mut output = Vec::new();
    let mut index = 0;
    while index < tokens.len() {
        let Token::StartTag(start) = &tokens[index] else {
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
            if let Token::EndTag(end) = &tokens[end_index]
                && end.name.as_ref() == b"noframes"
            {
                break;
            }
            end_index += 1;
        }
        if end_index < tokens.len() {
            let end = match &tokens[end_index] {
                Token::EndTag(end) => end.span,
                _ => unreachable!(),
            };
            if let Some(text) = source.get(start.span.end..end.start) {
                output.push(Token::String(Spanned {
                    value: text.as_bytes().to_vec().into(),
                    span: Span {
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

fn expand_markup_contexts(source: &str, tokens: Vec<Token<usize>>) -> Vec<Token<usize>> {
    let mut output = Vec::new();
    let mut foreign_stack: Vec<bool> = Vec::new();
    let mut raw_context: Option<(Vec<u8>, bool)> = None;
    for token in tokens {
        match &token {
            Token::StartTag(tag) => {
                let name = tag.name.as_ref();
                let in_foreign = foreign_stack
                    .last()
                    .is_some_and(|integration| !*integration);
                let integration = in_foreign && is_integration_point(name);
                if !tag.self_closing
                    && (matches!(name, b"svg" | b"math") || in_foreign && !integration)
                {
                    foreign_stack.push(false);
                } else if integration && !tag.self_closing {
                    foreign_stack.push(true);
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
            Token::String(text) if raw_context.is_some() => {
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
            Token::EndTag(tag) => {
                if raw_context
                    .as_ref()
                    .is_some_and(|(name, _)| name.as_slice() == tag.name.as_ref())
                {
                    raw_context = None;
                }
                if !foreign_stack.is_empty() {
                    foreign_stack.pop();
                }
                output.push(token);
            }
            _ => output.push(token),
        }
    }
    output
}

fn is_integration_point(name: &[u8]) -> bool {
    matches!(
        name,
        b"foreignobject" | b"mi" | b"mo" | b"mn" | b"ms" | b"mtext"
    )
}

fn shift_token(mut token: Token<usize>, offset: usize) -> Token<usize> {
    let offset = offset as isize;
    match &mut token {
        Token::StartTag(StartTag {
            span, attributes, ..
        }) => {
            *span = shift_span(*span, offset);
            for value in attributes.values_mut() {
                value.span = shift_span(value.span, offset);
            }
        }
        Token::EndTag(tag) => tag.span = shift_span(tag.span, offset),
        Token::String(text) | Token::Comment(text) => text.span = shift_span(text.span, offset),
        Token::Doctype(doctype) => doctype.span = shift_span(doctype.span, offset),
        Token::Error(error) => error.span = shift_span(error.span, offset),
    }
    token
}

fn shift_span(span: Span<usize>, offset: isize) -> Span<usize> {
    Span {
        start: span.start.saturating_add_signed(offset),
        end: span.end.saturating_add_signed(offset),
    }
}

fn normalize(mut token: Token<usize>) -> ParsedToken {
    let reserved_navigation = matches!(
        &token,
        Token::StartTag(tag) if tag.attributes.keys().any(|name| reserved_navigation_attribute(name))
    );
    let mut ignored_attributes = Vec::new();
    let mut source_signature = None;
    if let Token::StartTag(tag) = &mut token {
        let element = String::from_utf8_lossy(&tag.name);
        source_signature = ignore_source_signature(
            &element,
            tag.attributes.iter().map(|(name, value)| {
                (
                    String::from_utf8_lossy(name).into_owned(),
                    String::from_utf8_lossy(&value.value).into_owned(),
                )
            }),
        );
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
        token,
        ignored_attributes,
        reserved_navigation,
        source_signature,
    }
}

/// Match original wrappers across parser boundaries without exposing discarded attribute values.
pub fn ignore_source_signature(
    element: &str,
    attributes: impl IntoIterator<Item = (String, String)>,
) -> Option<String> {
    if !matches!(element, "mokly-ignore" | "mokly-ignore-scope") {
        return None;
    }
    let attributes: BTreeMap<_, _> = attributes.into_iter().collect();
    Some(material::digest(
        format!("{element}:{attributes:?}").as_bytes(),
    ))
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

#[cfg(test)]
#[path = "_tests_/ignore_parsing_tests.rs"]
mod ignore_parsing_tests;
