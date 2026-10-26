//! Convert html5gum values into Mokly-owned HTML tokens.

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
