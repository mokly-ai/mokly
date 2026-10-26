//! Convert and prepare html5gum values at the Mokly-owned token boundary.

use std::borrow::Cow;

use html5gum::{DefaultEmitter, Tokenizer};
use html5gum::{HtmlString, Span, Spanned};

use crate::html_token_types::{Doctype, EndTag, Error, ErrorToken, StartTag, Token};

pub(crate) fn own_token(token: html5gum::Token<usize>) -> crate::html_token_types::Token {
    match token {
        html5gum::Token::StartTag(tag) => Token::StartTag(StartTag {
            name: tag.name.0,
            attributes: tag
                .attributes
                .into_iter()
                .map(|(name, value)| (name.0, own_spanned(value)))
                .collect(),
            self_closing: tag.self_closing,
            span: own_span(tag.span),
        }),
        html5gum::Token::EndTag(tag) => Token::EndTag(EndTag {
            name: tag.name.0,
            span: own_span(tag.span),
        }),
        html5gum::Token::String(value) => Token::String(own_spanned(value)),
        html5gum::Token::Comment(value) => Token::Comment(own_spanned(value)),
        html5gum::Token::Doctype(value) => {
            let data = value.value;
            Token::Doctype(Doctype {
                name: Some(data.name.0),
                public_identifier: data.public_identifier.map(|id| id.0),
                system_identifier: data.system_identifier.map(|id| id.0),
                force_quirks: data.force_quirks,
                span: own_span(value.span),
            })
        }
        html5gum::Token::Error(value) => Token::Error(ErrorToken {
            value: if value.value == html5gum::Error::DuplicateAttribute {
                Error::DuplicateAttribute
            } else {
                Error::Other(format!("{:?}", value.value))
            },
            span: own_span(value.span),
        }),
    }
}

pub(crate) fn tokenize(source: &str, switch_states: bool) -> Vec<html5gum::Token<usize>> {
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(switch_states);
    Tokenizer::new_with_emitter(source, emitter)
        .flatten()
        .collect()
}

pub(crate) fn collapse_raw_elements(
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

pub(crate) fn expand_markup_contexts(
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

fn own_span(span: Span<usize>) -> crate::html_token_types::Span {
    crate::html_token_types::Span {
        start: span.start,
        end: span.end,
    }
}

fn own_spanned(value: Spanned<HtmlString, usize>) -> crate::html_token_types::Spanned {
    crate::html_token_types::Spanned {
        value: value.value.0,
        span: own_span(value.span),
    }
}
