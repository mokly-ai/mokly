//! Token checks retain duplicate attributes that an HTML tree must discard.

use mokly_catalogue::html_input::{DeliveredHtml, HtmlInput};
use mokly_catalogue::html_tokens::{self, Error, Token};

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};

/// Reject reserved authored metadata before HTML5 parsing removes duplicates.
pub fn validate<'a>(input: impl Into<HtmlInput<'a>>, fragment_markers: bool) -> Result<()> {
    let input = input.into();
    let source = input.text();
    for parsed in html_tokens::parse(input) {
        match parsed.token {
            Token::StartTag(_) if parsed.reserved_navigation => {
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
                let navigation = matches!(
                    name.as_str(),
                    "href" | "data-nav-href" | "data-mokly-link" | "data-mokly-target"
                ) || name.starts_with("data-mokly-link-control");
                if navigation {
                    return Err(invalid(
                        Code::BuildInvalid,
                        format!("duplicate navigation attribute {name}"),
                    ));
                }
                if fragment_markers {
                    return Err(invalid(
                        Code::BuildInvalid,
                        format!("duplicate attribute {name} in consumer output"),
                    ));
                }
            }
            _ => {}
        }
    }
    Ok(())
}

/// Validate callback page structure before the parser can imply missing wrappers.
pub fn page(html: DeliveredHtml<'_>) -> Result<()> {
    let source = html.text();
    let mut counts = [0, 0, 0];
    for parsed in html_tokens::parse(html) {
        if let Token::StartTag(tag) = parsed.token {
            for (index, name) in ["html", "head", "body"].iter().enumerate() {
                if tag.name.as_slice() == name.as_bytes() {
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
