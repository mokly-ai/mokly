//! Authored HTML inputs and component registry metadata for discovery validation.

use std::collections::BTreeMap;

use mokly_model::prop_schema::PropSchema;

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
