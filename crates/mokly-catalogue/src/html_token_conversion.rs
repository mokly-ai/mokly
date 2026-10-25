//! Convert html5gum values into Mokly-owned HTML tokens.

use html5gum::{HtmlString, Span, Spanned, Token as RawToken};

use crate::html_token_types::{
    Doctype, EndTag, Error, ErrorToken, Span as OwnedSpan, Spanned as OwnedSpanned, StartTag, Token,
};

pub(crate) fn own_token(token: RawToken<usize>) -> Token {
    match token {
        RawToken::StartTag(tag) => Token::StartTag(StartTag {
            name: tag.name.0,
            attributes: tag
                .attributes
                .into_iter()
                .map(|(name, value)| (name.0, own_spanned(value)))
                .collect(),
            self_closing: tag.self_closing,
            span: own_span(tag.span),
        }),
        RawToken::EndTag(tag) => Token::EndTag(EndTag {
            name: tag.name.0,
            span: own_span(tag.span),
        }),
        RawToken::String(value) => Token::String(own_spanned(value)),
        RawToken::Comment(value) => Token::Comment(own_spanned(value)),
        RawToken::Doctype(value) => {
            let data = value.value;
            Token::Doctype(Doctype {
                name: Some(data.name.0),
                public_identifier: data.public_identifier.map(|id| id.0),
                system_identifier: data.system_identifier.map(|id| id.0),
                force_quirks: data.force_quirks,
                span: own_span(value.span),
            })
        }
        RawToken::Error(value) => Token::Error(ErrorToken {
            value: if value.value == html5gum::Error::DuplicateAttribute {
                Error::DuplicateAttribute
            } else {
                Error::Other(format!("{:?}", value.value))
            },
            span: own_span(value.span),
        }),
    }
}

fn own_span(span: Span<usize>) -> OwnedSpan {
    OwnedSpan {
        start: span.start,
        end: span.end,
    }
}

fn own_spanned(value: Spanned<HtmlString, usize>) -> OwnedSpanned {
    OwnedSpanned {
        value: value.value.0,
        span: own_span(value.span),
    }
}
