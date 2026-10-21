//! Authored HTML token boundary with separate diagnostic metadata.

use std::collections::BTreeMap;

use html5gum::{DefaultEmitter, Span, StartTag, Token, Tokenizer};
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
    let tokens = expand_markup_contexts(tokenize(source, true));
    tokens.into_iter().map(normalize)
}

fn tokenize(source: &str, switch_states: bool) -> Vec<Token<usize>> {
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(switch_states);
    Tokenizer::new_with_emitter(source, emitter)
        .flatten()
        .collect()
}

fn expand_markup_contexts(tokens: Vec<Token<usize>>) -> Vec<Token<usize>> {
    let mut output = Vec::new();
    let mut foreign_depth: usize = 0;
    let mut raw_context = None;
    for token in tokens {
        match &token {
            Token::StartTag(tag) => {
                let name = tag.name.as_ref();
                if matches!(name, b"svg" | b"math") {
                    foreign_depth += 1;
                }
                if name == b"noscript" || foreign_depth > 0 && matches!(name, b"style" | b"title") {
                    raw_context = Some(name.to_owned());
                }
                output.push(token);
            }
            Token::String(text) if raw_context.is_some() => {
                let value = String::from_utf8_lossy(&text.value);
                output.extend(
                    tokenize(&value, false)
                        .into_iter()
                        .map(|token| shift_token(token, text.span.start)),
                );
            }
            Token::EndTag(tag) => {
                if raw_context.as_deref() == Some(tag.name.as_ref()) {
                    raw_context = None;
                }
                if matches!(tag.name.as_ref(), b"svg" | b"math") {
                    foreign_depth = foreign_depth.saturating_sub(1);
                }
                output.push(token);
            }
            _ => output.push(token),
        }
    }
    output
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
pub fn ignore_warning_message(attribute: &str, tag: &[u8]) -> String {
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
