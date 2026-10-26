//! The rules of the design stylesheets and the colours of their boundaries
//! and fills.

use std::fs;

use regex::{Regex, escape};
use walkdir::WalkDir;

use crate::support::repository_root;

/// A CSS rule in one of the design stylesheets.
pub(crate) struct StyleRule {
    /// The stylesheet path relative to `examples/basic`.
    pub(crate) file: String,
    /// The selector with whitespace runs collapsed.
    pub(crate) selector: String,
    /// The declarations between the braces.
    pub(crate) body: String,
}

/// A colour reference: a palette token or a literal that the CSS pins.
pub(crate) enum ColorReference {
    /// A `var(--token)` reference.
    Token(String),
    /// A `#rgb` or `#rrggbb` literal.
    Literal(String),
}

impl ColorReference {
    /// The token or the literal, for messages.
    pub(crate) fn describe(&self) -> &str {
        match self {
            Self::Token(text) | Self::Literal(text) => text,
        }
    }
}

/// Every rule in every design stylesheet, including the shared library.
pub(crate) fn design_style_rules() -> Vec<StyleRule> {
    let catalogue = repository_root().join("examples/basic");
    let rule = Regex::new(r"([^{}]+)\{([^}]*)\}").unwrap();
    let whitespace = Regex::new(r"\s+").unwrap();
    let mut rules = Vec::new();
    for entry in WalkDir::new(&catalogue).min_depth(1) {
        let entry = entry.unwrap();
        let name = entry.file_name().to_str().unwrap_or_default();
        if !entry.file_type().is_file() || !name.ends_with(".css") {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(&catalogue)
            .unwrap()
            .components()
            .map(|component| component.as_os_str().to_str().unwrap())
            .collect::<Vec<_>>()
            .join("/");
        if !is_design_stylesheet(&relative) {
            continue;
        }
        let source = fs::read_to_string(entry.path()).unwrap();
        for found in rule.captures_iter(&source) {
            if found[2].is_empty() {
                continue;
            }
            rules.push(StyleRule {
                file: relative.clone(),
                selector: whitespace.replace_all(&found[1], " ").trim().to_owned(),
                body: found[2].to_owned(),
            });
        }
    }
    rules
}

/// The boundary a rule draws, from `border-color`, `border`, or `outline`.
pub(crate) fn boundary_of(body: &str) -> Option<ColorReference> {
    ["border-color", "border", "outline"]
        .into_iter()
        .find_map(|property| color_reference(declaration(body, property)))
}

/// The fill a rule paints behind that boundary.
pub(crate) fn fill_of(body: &str) -> Option<ColorReference> {
    ["background-color", "background"]
        .into_iter()
        .find_map(|property| color_reference(declaration(body, property)))
}

/// The design catalogue's own chrome. `styles.css` and
/// `example-components.css` style the depicted product inside a device
/// screen, so they carry their own colours outside the interface palette.
fn is_design_stylesheet(relative: &str) -> bool {
    relative.starts_with("design-library/")
        || (!relative.contains('/') && relative.starts_with("design"))
}

/// One declaration's value, ignoring shorthand extras like `1px solid`.
fn declaration(body: &str, property: &str) -> Option<String> {
    let pattern = format!(r"(?:^|;|\{{)\s*{}\s*:\s*([^;]+)", escape(property));
    Regex::new(&pattern)
        .unwrap()
        .captures(body)
        .map(|value| value[1].trim().to_owned())
}

/// The colour of a declaration value, whether tokenised or hardcoded.
fn color_reference(value: Option<String>) -> Option<ColorReference> {
    let value = value.filter(|value| !value.is_empty())?;
    let token = Regex::new(r"var\((--[a-z0-9-]+)\)").unwrap();
    if let Some(token) = token.captures(&value) {
        return Some(ColorReference::Token(token[1].to_owned()));
    }
    Regex::new(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
        .unwrap()
        .find(&value)
        .map(|literal| ColorReference::Literal(literal.as_str().to_owned()))
}
