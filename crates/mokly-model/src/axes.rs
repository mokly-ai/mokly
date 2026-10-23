//! Shared entry kinds and rendering axes.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Path-unique catalogue entry kind.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum EntryKind {
    /// Registered component, including its variants.
    Component,
    /// Markdown document.
    Document,
    /// Complete authored HTML document.
    Page,
    /// Screen with viewport views.
    Screen,
    /// Ordered screen journey.
    UseCase,
}

impl EntryKind {
    /// Stable wire name.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Component => "component",
            Self::Document => "document",
            Self::Page => "page",
            Self::Screen => "screen",
            Self::UseCase => "use-case",
        }
    }
}

/// Supported color scheme, ordered light first.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum ColorScheme {
    /// Light document.
    Light,
    /// Dark document.
    Dark,
}

/// Supported viewport, ordered mobile first.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum Viewport {
    /// Mobile viewport.
    Mobile,
    /// Desktop viewport.
    Desktop,
}
