//! Authored HTML token boundary with separate diagnostic metadata.

use std::collections::BTreeMap;

use html5gum::{DefaultEmitter, Token, Tokenizer};
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
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(true);
    Tokenizer::new_with_emitter(source, emitter)
        .flatten()
        .map(|mut token| {
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
        })
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

/// Navigation attributes that authored markup cannot supply, including future control fields.
pub fn reserved_navigation_attribute(name: &[u8]) -> bool {
    name == b"data-mokly-link" || name.starts_with(b"data-mokly-link-control")
}

#[cfg(test)]
#[path = "_tests_/ignore_parsing_tests.rs"]
mod ignore_parsing_tests;
