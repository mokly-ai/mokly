//! Token checks retain duplicate attributes that an HTML tree must discard.

use html5gum::{DefaultEmitter, Error, Token, Tokenizer};

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};

/// Reject reserved authored metadata before HTML5 parsing removes duplicates.
pub fn validate(source: &str, fragment_markers: bool) -> Result<()> {
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(true);
    for token in Tokenizer::new_with_emitter(source, emitter).flatten() {
        match token {
            Token::StartTag(tag)
                if tag.attributes.keys().any(|name| {
                    name.as_ref() == b"data-mokly-link"
                        || name.starts_with(b"data-mokly-link-control")
                }) =>
            {
                return Err(invalid(
                    Code::BuildInvalid,
                    "reserved navigation metadata in consumer output",
                ));
            }
            Token::Error(error) if error.value == Error::DuplicateAttribute => {
                let name = source
                    .get(error.span.start..error.span.end)
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if matches!(
                    name.as_str(),
                    "href" | "data-nav-href" | "data-mokly-link" | "data-mokly-target"
                ) || name.starts_with("data-mokly-link-control")
                    || fragment_markers
                {
                    return Err(invalid(
                        Code::BuildInvalid,
                        format!("duplicate navigation attribute {name}"),
                    ));
                }
            }
            _ => {}
        }
    }
    Ok(())
}

/// Validate callback page structure before the parser can imply missing wrappers.
pub fn page(source: &str) -> Result<()> {
    let mut emitter = DefaultEmitter::<usize>::new_with_span();
    emitter.naively_switch_states(true);
    let mut counts = [0, 0, 0];
    for token in Tokenizer::new_with_emitter(source, emitter).flatten() {
        if let Token::StartTag(tag) = token {
            for (index, name) in ["html", "head", "body"].iter().enumerate() {
                if tag.name.as_ref() == name.as_bytes() {
                    counts[index] += 1;
                }
            }
        }
    }
    if !source
        .trim_start()
        .to_ascii_lowercase()
        .starts_with("<!doctype html>")
        || counts != [1, 1, 1]
    {
        return Err(invalid(
            Code::HtmlElement,
            "page must start with <!doctype html> and contain one html, head and body element",
        ));
    }
    Ok(())
}
