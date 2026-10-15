//! Typed render diagnostic categories shared by HTML, graph, and terminal adapters.

use std::fmt;

/// Stable public diagnostic code for rendering failures.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Code {
    /// Invalid final output or navigation.
    BuildInvalid,
    /// Invalid authored element or ignore wrapper.
    HtmlElement,
    /// Invalid coerced component attribute.
    HtmlAttribute,
    /// Invalid template prop reference.
    HtmlProps,
    /// Invalid supplied or declared slot.
    HtmlSlot,
    /// An unknown catalogue destination.
    UnknownLinkTarget,
    /// A destination with a recorded replacement path.
    MovedLinkTarget,
}

impl Code {
    /// Exact diagnostic spelling for terminal presentation.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::BuildInvalid => "build-invalid",
            Self::HtmlElement => "html-element",
            Self::HtmlAttribute => "html-attribute",
            Self::HtmlProps => "html-props",
            Self::HtmlSlot => "html-slot",
            Self::UnknownLinkTarget => "unknown-link-target",
            Self::MovedLinkTarget => "moved-link-target",
        }
    }
}

impl fmt::Display for Code {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}
