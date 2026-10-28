//! Token spans match html5gum's own emitter, so diagnostics point at the authored text.

use html5gum::{DefaultEmitter, Tokenizer};

use crate::html_input::DeliveredHtml;
use crate::html_token_types::Error;
use crate::html_tokens::{self, Token};

const HTML_ONLY: &[&str] = &[
    "<p class=a id='b' title=\"c &amp; d\">Text &lt; more</p>",
    "<style>.x{color:{{missing}}}</style><p>after</p>",
    "<p>intro</p>\n\n\n<style>\n.x{color:{{missing}}}</style>",
    "<title>A &amp; {{t}}</title>",
    "<textarea>\n{{x}} <b></textarea>",
    "<xmp><b>{{x}}</b></xmp>",
    "<iframe><p>{{x}}</p></iframe>",
    "<noembed><p>{{x}}</p></noembed>",
    "<script>if (a < b) { x = '{{x}}'; }</script>",
    "<script><!--<script>x</script>--></script>after",
    "<plaintext><p>{{x}}</p>",
    "<!-- note --><p a=1 a=2 b>dup</p>",
];

fn describe(token: Token) -> String {
    match token {
        Token::StartTag(tag) => {
            let attributes: Vec<_> = tag
                .attributes
                .iter()
                .map(|(name, value)| (name.clone(), value.value.clone(), value.span))
                .collect();
            format!(
                "start {:?} {attributes:?} {} {:?}",
                tag.name, tag.self_closing, tag.span
            )
        }
        Token::EndTag(tag) => format!("end {:?} {:?}", tag.name, tag.span),
        Token::String(text) => format!("text {:?} {:?}", text.value, text.span),
        Token::Comment(text) => format!("comment {:?} {:?}", text.value, text.span),
        Token::Doctype(doctype) => format!("doctype {:?} {:?}", doctype.name, doctype.span),
        Token::Error(error) => format!("error {:?} {:?}", error.value, error.span),
    }
}

fn reference(source: &str) -> Vec<String> {
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(true);
    Tokenizer::new_with_emitter(source, emitter)
        .flatten()
        .map(|token| {
            let span = |span: html5gum::Span<usize>| crate::html_token_types::Span {
                start: span.start,
                end: span.end,
            };
            let spanned = |value: html5gum::Spanned<html5gum::HtmlString, usize>| {
                crate::html_token_types::Spanned {
                    value: value.value.0,
                    span: span(value.span),
                }
            };
            describe(match token {
                html5gum::Token::StartTag(tag) => {
                    Token::StartTag(crate::html_token_types::StartTag {
                        name: tag.name.0,
                        attributes: tag
                            .attributes
                            .into_iter()
                            .map(|(name, value)| (name.0, spanned(value)))
                            .collect(),
                        self_closing: tag.self_closing,
                        span: span(tag.span),
                    })
                }
                html5gum::Token::EndTag(tag) => Token::EndTag(crate::html_token_types::EndTag {
                    name: tag.name.0,
                    span: span(tag.span),
                }),
                html5gum::Token::String(text) => Token::String(spanned(text)),
                html5gum::Token::Comment(text) => Token::Comment(spanned(text)),
                html5gum::Token::Doctype(doctype) => {
                    Token::Doctype(crate::html_token_types::Doctype {
                        name: Some(doctype.value.name.0),
                        public_identifier: None,
                        system_identifier: None,
                        force_quirks: doctype.value.force_quirks,
                        span: span(doctype.span),
                    })
                }
                html5gum::Token::Error(error) => {
                    Token::Error(crate::html_token_types::ErrorToken {
                        value: if error.value == html5gum::Error::DuplicateAttribute {
                            Error::DuplicateAttribute
                        } else {
                            Error::Other(format!("{:?}", error.value))
                        },
                        span: span(error.span),
                    })
                }
            })
        })
        .collect()
}

fn ours(source: &str) -> Vec<String> {
    html_tokens::parse(DeliveredHtml::fragment(source))
        .map(|parsed| describe(parsed.token))
        .collect()
}

#[test]
fn html_tokens_match_the_html5gum_emitter() {
    for source in HTML_ONLY {
        assert_eq!(ours(source), reference(source), "{source}");
    }
}

#[test]
fn text_spans_cover_their_own_source_text() {
    let foreign = [
        "<svg><![CDATA[{{x}}]]></svg>",
        "<svg>ab<![CDATA[cd]]></svg>",
        "<math><mi><p><b>1</p>2<![CDATA[3]]>",
        "<svg><style>.x{{{y}}}</style></svg>",
        "<svg><![CDATA[cd]]>ef</svg>",
        "<svg><![CDATA[a]]>\n{{x}}</svg>",
    ];
    for source in HTML_ONLY.iter().chain(&foreign) {
        let mut previous_end = 0;
        for parsed in html_tokens::parse(DeliveredHtml::fragment(source)) {
            let span = match &parsed.token {
                Token::Error(_) => continue,
                Token::StartTag(tag) => tag.span,
                Token::EndTag(tag) => tag.span,
                Token::Comment(text) => text.span,
                Token::Doctype(doctype) => doctype.span,
                Token::String(text) => {
                    let slice = &source[text.span.start..text.span.end];
                    if !slice.contains('&') {
                        assert_eq!(slice.as_bytes(), text.value.as_slice(), "{source}");
                    }
                    text.span
                }
            };
            assert!(
                span.start >= previous_end,
                "{source}: {span:?} before {previous_end}"
            );
            previous_end = span.end;
        }
    }
}
