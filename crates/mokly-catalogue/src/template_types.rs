//! Authored HTML inputs and component registry metadata for discovery validation.

use std::collections::BTreeMap;

use mokly_model::catalogue::SourceLocation;
use mokly_model::prop_schema::PropSchema;
use serde::Serialize;

use crate::html_input::{AuthoredHtml, HtmlOrigin, HtmlShape, line_and_column};

/// A private authored body, retained outside catalogue JSON for composition.
#[derive(Clone, Debug)]
pub struct Template {
    /// Source's repository-relative path.
    pub source_path: String,
    /// Complete original source, for exact locations.
    pub source: String,
    /// Body text after front matter.
    pub body: String,
    /// Body's UTF-8 byte offset in the original source.
    pub body_offset: usize,
    /// True for one complete authored page document.
    pub page: bool,
}

/// One saved variant slot body and its authored front matter position.
#[derive(Clone, Debug, Serialize)]
pub struct SavedSlot {
    /// The HTML fragment supplied to the declared slot.
    pub body: String,
    /// The source position of the `variants/{index}/slots/{name}` field.
    pub source: SourceLocation,
}

impl Template {
    /// The authored body, read as a page document or as a fragment, without source positions.
    pub fn html(&self) -> AuthoredHtml<'_> {
        self.derived_html(&self.body)
    }

    /// The authored body with its source origin, so that the parse records source positions.
    pub fn located_html(&self) -> AuthoredHtml<'_> {
        let (line, column) = line_and_column(&self.source, self.body_offset);
        let origin = HtmlOrigin {
            path: &self.source_path,
            line,
            column,
        };
        AuthoredHtml::new(&self.body, self.shape(), Some(origin))
    }

    /// Text derived from the body, such as the body after prop substitution, without positions.
    pub fn derived_html<'a>(&self, text: &'a str) -> AuthoredHtml<'a> {
        AuthoredHtml::new(text, self.shape(), None)
    }

    fn shape(&self) -> HtmlShape {
        if self.page {
            HtmlShape::Document
        } else {
            HtmlShape::Fragment
        }
    }
}

impl SavedSlot {
    /// The saved fragment, read as authored HTML without source positions.
    pub fn html(&self) -> AuthoredHtml<'_> {
        AuthoredHtml::new(&self.body, HtmlShape::Fragment, None)
    }
}

/// Registry metadata needed before the first render.
#[derive(Clone, Debug)]
pub struct RegisteredElement {
    /// Base for relative links authored by this component's body.
    pub link_base: String,
    /// Current component parent path.
    pub path: String,
    /// Defining source path.
    pub source_path: String,
    /// Validated component schema.
    pub prop_schema: PropSchema,
    /// Declared slot names.
    pub slots: Vec<String>,
}

/// Shared HTML and JavaScript element namespace.
pub type ElementRegistry = BTreeMap<String, RegisteredElement>;

/// Whether an attribute belongs to an ignore wrapper; ordinary elements keep all attributes.
pub fn ignore_attribute_allowed(element: &str, attribute: &str) -> bool {
    match element {
        "mokly-ignore" => matches!(
            attribute,
            "id" | "material-key" | "mokly-if" | "mokly-viewport"
        ),
        "mokly-ignore-scope" => matches!(attribute, "enabled" | "mokly-if" | "mokly-viewport"),
        _ => true,
    }
}
