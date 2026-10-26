//! Authored HTML token boundary with separate diagnostic metadata.

use std::collections::BTreeMap;

use crate::html_input::{DeliveredHtml, HtmlInput};
use crate::html_token_conversion::{
    collapse_raw_elements, expand_markup_contexts, own_token, tokenize,
};
pub use crate::html_token_types::{
    Doctype, EndTag, Error, ErrorToken, Span, Spanned, StartTag, Token,
};
use crate::template_types::ignore_attribute_allowed;

/// One authored token and the diagnostics retained at the token boundary.
pub struct ParsedToken {
    /// The token visible to template, link, and source-location consumers.
    pub token: Token,
    /// Discarded ignore-wrapper attribute names, without their unevaluated values.
    pub ignored_attributes: Vec<String>,
    /// Whether the original tag supplied reserved navigation metadata.
    pub reserved_navigation: bool,
}

/// Parse HTML while retaining token errors and original byte spans.
///
/// Authored input drops unknown ignore-wrapper attributes and reports their names. Delivered
/// input keeps every attribute.
pub fn parse<'a>(input: impl Into<HtmlInput<'a>>) -> impl Iterator<Item = ParsedToken> + 'a {
    let input = input.into();
    let source = input.text();
    let authored = matches!(input, HtmlInput::Authored(_));
    let tokens = expand_markup_contexts(
        source,
        collapse_raw_elements(source, tokenize(source, true)),
    );
    tokens
        .into_iter()
        .map(move |token| normalize(token, authored))
}

/// Parse one attribute list through the same authored HTML boundary.
pub fn parse_attributes(source: &str) -> Option<BTreeMap<String, String>> {
    let synthetic = format!("<i {source}></i>");
    let mut tags = 0;
    let mut attributes = None;
    for parsed in parse(DeliveredHtml::fragment(&synthetic)) {
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

fn normalize(mut token: html5gum::Token<usize>, authored: bool) -> ParsedToken {
    let reserved_navigation = matches!(
        &token,
        html5gum::Token::StartTag(tag) if tag.attributes.keys().any(|name| reserved_navigation_attribute(name))
    );
    let mut ignored_attributes = Vec::new();
    if authored && let html5gum::Token::StartTag(tag) = &mut token {
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
