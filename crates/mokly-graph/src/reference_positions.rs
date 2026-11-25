//! Shared resource reference positions in HTML trees.

/// How an attribute value supplies resource references.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReferenceKind {
    /// A single URL.
    Url,
    /// A `srcset` list of candidate URLs.
    Srcset,
    /// An embedded HTML document.
    EmbeddedDocument,
}

struct Position {
    element: Option<&'static str>,
    attribute: &'static str,
    kind: Option<ReferenceKind>,
}

/// Read the first matching row. Specific exclusions precede general positions.
const POSITIONS: &[Position] = &[
    Position {
        element: Some("base"),
        attribute: "href",
        kind: None,
    },
    Position {
        element: None,
        attribute: "src",
        kind: Some(ReferenceKind::Url),
    },
    Position {
        element: None,
        attribute: "href",
        kind: Some(ReferenceKind::Url),
    },
    Position {
        element: None,
        attribute: "xlink:href",
        kind: Some(ReferenceKind::Url),
    },
    Position {
        element: None,
        attribute: "srcset",
        kind: Some(ReferenceKind::Srcset),
    },
    Position {
        element: None,
        attribute: "poster",
        kind: Some(ReferenceKind::Url),
    },
    Position {
        element: Some("object"),
        attribute: "data",
        kind: Some(ReferenceKind::Url),
    },
    Position {
        element: Some("iframe"),
        attribute: "srcdoc",
        kind: Some(ReferenceKind::EmbeddedDocument),
    },
];

/// Look up a position by lowercase local element name and qualified attribute name.
pub fn kind(element: &str, attribute: &str) -> Option<ReferenceKind> {
    POSITIONS
        .iter()
        .find(|position| {
            position.attribute == attribute && position.element.is_none_or(|name| name == element)
        })
        .and_then(|position| position.kind)
}

#[cfg(test)]
#[path = "_tests_/reference_positions_tests.rs"]
mod reference_positions_tests;
