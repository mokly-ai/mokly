//! Mokly-owned HTML token and span types.

use std::collections::BTreeMap;

/// A source span owned by Mokly's HTML token boundary.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Span {
    /// First byte in the source.
    pub start: usize,
    /// Byte after the token.
    pub end: usize,
}

/// A byte value and its source span.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Spanned {
    /// Token bytes.
    pub value: Vec<u8>,
    /// Source span.
    pub span: Span,
}

/// An authored start tag.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StartTag {
    /// Lower-cased tag name bytes.
    pub name: Vec<u8>,
    /// Attributes in authored order-independent form.
    pub attributes: BTreeMap<Vec<u8>, Spanned>,
    /// Whether the tag had a self-closing marker.
    pub self_closing: bool,
    /// Full source span.
    pub span: Span,
}

/// An authored end tag.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EndTag {
    /// Tag name bytes.
    pub name: Vec<u8>,
    /// Full source span.
    pub span: Span,
}

/// A parser diagnostic retained by the boundary.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Error {
    /// A start tag repeated an attribute name.
    DuplicateAttribute,
    /// Any other tokenizer diagnostic.
    Other(String),
}

/// A parser diagnostic and its source span.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ErrorToken {
    /// Diagnostic kind.
    pub value: Error,
    /// Diagnostic span.
    pub span: Span,
}

/// A doctype token.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Doctype {
    /// Doctype name.
    pub name: Option<Vec<u8>>,
    /// Public identifier.
    pub public_identifier: Option<Vec<u8>>,
    /// System identifier.
    pub system_identifier: Option<Vec<u8>>,
    /// Whether the tokenizer forced quirks mode.
    pub force_quirks: bool,
    /// Full source span.
    pub span: Span,
}

/// A token produced by Mokly's authored HTML boundary.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Token {
    /// Start tag.
    StartTag(StartTag),
    /// End tag.
    EndTag(EndTag),
    /// Character data.
    String(Spanned),
    /// Comment data.
    Comment(Spanned),
    /// Doctype.
    Doctype(Doctype),
    /// Tokenizer diagnostic.
    Error(ErrorToken),
}
