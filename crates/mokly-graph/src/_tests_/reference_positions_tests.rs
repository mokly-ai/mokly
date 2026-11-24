//! Attribute classification for shared resource reference positions.

use super::{ReferenceKind, kind};

#[test]
fn classifies_resource_references_by_element_and_attribute() {
    for (element, attribute, expected) in [
        ("ui-media", "src", Some(ReferenceKind::Url)),
        ("ui-media", "href", Some(ReferenceKind::Url)),
        ("ui-media", "xlink:href", Some(ReferenceKind::Url)),
        ("ui-media", "srcset", Some(ReferenceKind::Srcset)),
        ("ui-media", "poster", Some(ReferenceKind::Url)),
        ("object", "data", Some(ReferenceKind::Url)),
        ("iframe", "srcdoc", Some(ReferenceKind::EmbeddedDocument)),
        ("p", "data", None),
        ("div", "srcdoc", None),
        ("button", "data-nav-href", None),
    ] {
        assert_eq!(kind(element, attribute), expected, "{element}[{attribute}]");
    }
}
