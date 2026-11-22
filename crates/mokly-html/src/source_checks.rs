//! Source checks consume original tokens before HTML tree repair discards evidence.

use std::cell::RefCell;

use mokly_catalogue::html_driver::TokenObserver;
use mokly_catalogue::html_input::{DeliveredHtml, HtmlInput};
use mokly_catalogue::html_tokens::{self, Error, Token, reserved_navigation_attribute};

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};

enum Violation {
    ReservedNavigation,
    DuplicateNavigation(String),
    DuplicateAttribute(String),
}

#[derive(Default)]
struct Evidence {
    page_tags: [usize; 3],
    violation: Option<Violation>,
}

/// Bounded evidence from the original parse, checked after callback warnings are retained.
pub(crate) struct SourceChecks<'a> {
    source: &'a str,
    fragment_markers: bool,
    evidence: RefCell<Evidence>,
}

impl<'a> SourceChecks<'a> {
    pub(crate) fn new(source: &'a str, fragment_markers: bool) -> Self {
        Self {
            source,
            fragment_markers,
            evidence: RefCell::default(),
        }
    }

    fn record(&self, token: &Token, reserved_navigation: bool) {
        let mut evidence = self.evidence.borrow_mut();
        if let Token::StartTag(tag) = token {
            for (index, name) in [b"html".as_slice(), b"head", b"body"].iter().enumerate() {
                if tag.name == *name {
                    evidence.page_tags[index] += 1;
                }
            }
        }
        if evidence.violation.is_some() {
            return;
        }
        evidence.violation = match token {
            Token::StartTag(_) if reserved_navigation => Some(Violation::ReservedNavigation),
            Token::Error(error) if error.value == Error::DuplicateAttribute => {
                let name = self
                    .source
                    .get(error.span.start..error.span.end)
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if matches!(
                    name.as_str(),
                    "href" | "data-nav-href" | "data-mokly-link" | "data-mokly-target"
                ) || name.starts_with("data-mokly-link-control")
                {
                    Some(Violation::DuplicateNavigation(name))
                } else if self.fragment_markers {
                    Some(Violation::DuplicateAttribute(name))
                } else {
                    None
                }
            }
            _ => None,
        };
    }

    fn page(&self) -> Result<()> {
        if !self
            .source
            .trim_start()
            .to_ascii_lowercase()
            .starts_with("<!doctype html>")
            || self.evidence.borrow().page_tags != [1, 1, 1]
        {
            return Err(invalid(
                Code::HtmlElement,
                "page must start with <!doctype html> and contain one html, head and body element",
            ));
        }
        Ok(())
    }

    /// Page structure keeps precedence over the first token-level source failure.
    pub(crate) fn validate(self, page: bool) -> Result<()> {
        if page {
            self.page()?;
        }
        match self.evidence.into_inner().violation {
            Some(Violation::ReservedNavigation) => Err(invalid(
                Code::BuildInvalid,
                "reserved navigation metadata in consumer output",
            )),
            Some(Violation::DuplicateNavigation(name)) => Err(invalid(
                Code::BuildInvalid,
                format!("duplicate navigation attribute {name}"),
            )),
            Some(Violation::DuplicateAttribute(name)) => Err(invalid(
                Code::BuildInvalid,
                format!("duplicate attribute {name} in consumer output"),
            )),
            None => Ok(()),
        }
    }
}

impl TokenObserver for SourceChecks<'_> {
    fn observe(&self, token: &Token) {
        let reserved_navigation = matches!(
            token,
            Token::StartTag(tag) if tag.attributes.keys().any(|name| reserved_navigation_attribute(name))
        );
        self.record(token, reserved_navigation);
    }
}

fn scan(input: HtmlInput<'_>, fragment_markers: bool) -> SourceChecks<'_> {
    let checks = SourceChecks::new(input.text(), fragment_markers);
    for parsed in html_tokens::parse(input) {
        checks.record(&parsed.token, parsed.reserved_navigation);
    }
    checks
}

/// Reject reserved authored metadata before HTML5 parsing removes duplicates.
pub fn validate<'a>(input: impl Into<HtmlInput<'a>>, fragment_markers: bool) -> Result<()> {
    scan(input.into(), fragment_markers).validate(false)
}

/// Validate callback page structure before the parser can imply missing wrappers.
pub fn page(html: DeliveredHtml<'_>) -> Result<()> {
    scan(html.into(), false).page()
}
