//! Source attribution shared by schema and props checks.

use std::fmt;

/// The authoring boundary that selects the protocol diagnostic.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthoringKind {
    /// HTML screen or component front matter.
    Html,
    /// A JavaScript definition, including a screen.
    JavaScript,
    /// A Storybook definition, identified by its story.
    Story,
}

/// Attribution supplied by the catalogue registry or reader.
#[derive(Clone, Debug)]
pub struct Context {
    /// Repository-relative file and export, or entry path.
    pub entry: String,
    /// Saved variant slug, when present.
    pub variant: Option<String>,
    /// Authoring boundary.
    pub kind: AuthoringKind,
}

/// Stable diagnostics selected by the authoring boundary.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DiagnosticCode {
    /// HTML schema or front matter failed validation.
    HtmlFrontMatter,
    /// An HTML prop value failed validation.
    HtmlAttribute,
    /// A JavaScript schema failed validation.
    ComponentSchema,
    /// JavaScript or story props failed validation.
    ComponentProps,
}

impl DiagnosticCode {
    /// Return the exact protocol diagnostic name.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::HtmlFrontMatter => "html-front-matter",
            Self::HtmlAttribute => "html-attribute",
            Self::ComponentSchema => "component-schema",
            Self::ComponentProps => "component-props",
        }
    }
}

impl fmt::Display for DiagnosticCode {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// A diagnostic with an exact JSON Pointer into the rejected input.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Diagnostic {
    /// Protocol diagnostic code.
    pub code: DiagnosticCode,
    /// Source entry or story.
    pub entry: String,
    /// Saved variant slug, when present.
    pub variant: Option<String>,
    /// JSON Pointer; the empty string names the root.
    pub path: String,
    /// Safe validation detail.
    pub message: String,
}

impl Context {
    /// Attach source context and select the schema or props diagnostic.
    pub fn diagnostic(&self, schema: bool, path: &str, message: impl Into<String>) -> Diagnostic {
        Diagnostic {
            code: match (self.kind, schema) {
                (AuthoringKind::Html, true) => DiagnosticCode::HtmlFrontMatter,
                (AuthoringKind::Html, false) => DiagnosticCode::HtmlAttribute,
                (_, true) => DiagnosticCode::ComponentSchema,
                (_, false) => DiagnosticCode::ComponentProps,
            },
            entry: self.entry.clone(),
            variant: self.variant.clone(),
            path: path.to_owned(),
            message: message.into(),
        }
    }
}

impl fmt::Display for Diagnostic {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.code, self.entry)?;
        if let Some(variant) = &self.variant {
            write!(formatter, " variant {variant}")?;
        }
        write!(formatter, " at {:?}: {}", self.path, self.message)
    }
}
