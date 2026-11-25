//! Typed failures with byte offsets in the authored body.

use std::ops::Range;

use minijinja::ErrorKind;
use thiserror::Error;

use crate::source_map::SourceMap;

/// Template syntax that Mokly forbids.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ForbiddenKind {
    /// Include statement.
    Include,
    /// Import statement.
    Import,
    /// From-import statement.
    From,
    /// Extends statement.
    Extends,
    /// Template inheritance block.
    Block,
    /// Auto-escape control block.
    AutoEscape,
    /// Safe filter or test.
    Safe,
}

/// An occurrence of a forbidden construct.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ForbiddenUse {
    /// The construct at this location.
    pub kind: ForbiddenKind,
    /// Authored byte range of the statement tag or filter or test name.
    pub source: Range<usize>,
}

/// A failure to compile or render a body.
#[derive(Debug, Error)]
pub enum TemplateError {
    /// MiniJinja rejected the template syntax.
    #[error("[mokly-template] {source}")]
    Syntax {
        /// Start of the offending authored tag, when available.
        offset: Option<usize>,
        /// The error from MiniJinja.
        #[source]
        source: minijinja::Error,
    },
    /// Evaluation failed.
    #[error("[mokly-template] {source}")]
    Render {
        /// Start of the offending authored tag, when available.
        offset: Option<usize>,
        /// The error from MiniJinja.
        #[source]
        source: minijinja::Error,
    },
    /// Evaluation ran out of fuel.
    #[error("[mokly-template] {source}")]
    Fuel {
        /// Start of the offending authored tag, when available.
        offset: Option<usize>,
        /// The error from MiniJinja.
        #[source]
        source: minijinja::Error,
    },
    /// The body contains forbidden constructs.
    #[error("[mokly-template] forbidden constructs in {name}: {constructs:?}")]
    Forbidden {
        /// Source identity of the body.
        name: String,
        /// All forbidden constructs in authored source order.
        constructs: Vec<ForbiddenUse>,
    },
    /// The value cannot be printed as HTML text or an attribute value.
    #[error("[mokly-template] {source}")]
    Props {
        /// Start of the offending authored tag, when available.
        offset: Option<usize>,
        /// The error from the formatter.
        #[source]
        source: minijinja::Error,
    },
}

impl TemplateError {
    /// Byte offset in the authored body, when available.
    pub fn offset(&self) -> Option<usize> {
        match self {
            Self::Syntax { offset, .. }
            | Self::Render { offset, .. }
            | Self::Fuel { offset, .. }
            | Self::Props { offset, .. } => *offset,
            Self::Forbidden { constructs, .. } => constructs.first().map(|item| item.source.start),
        }
    }

    pub(crate) fn syntax(source: minijinja::Error, map: &SourceMap) -> Self {
        Self::Syntax {
            offset: map.error_offset(&source),
            source,
        }
    }

    pub(crate) fn render(source: minijinja::Error, map: &SourceMap) -> Self {
        let offset = map.error_offset(&source);
        match source.kind() {
            ErrorKind::OutOfFuel => Self::Fuel { offset, source },
            ErrorKind::NonPrimitive => Self::Props { offset, source },
            _ => Self::Render { offset, source },
        }
    }
}
