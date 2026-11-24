//! The one owned stylesheet of a Markdown document, at the document's own address.

use mokly_model::{namespace, routes};

/// The family of each viewer face, in the order of `namespace::FONT_FACES`. Each
/// family is the first family of the matching document stack of the palette part.
const FAMILIES: [&str; 2] = ["Geist", "Geist Mono"];

/// The route-independent part: the colours and font stacks that
/// `npm run palette:generate` writes from the `@mokly/ui` palette, then the
/// hand-kept typography that reads them.
pub(crate) const STYLES: &str = concat!(
    include_str!("document_palette.css"),
    include_str!("document.css")
);

/// The stylesheet that the document at `route`, inside the generated namespace,
/// inlines: one `@font-face` rule for each face that the viewer delivers, then
/// `STYLES`.
///
/// Each face address is relative to the document's artifact path, so the same
/// bytes reach the viewer's faces in Serve, in a static build at any base path,
/// and as a snapshot inside a comparison generation, which holds a copy of each
/// face at the matching place.
pub(crate) fn stylesheet(route: &str) -> String {
    let source = namespace::generated(route);
    let faces: String = FAMILIES
        .into_iter()
        .zip(namespace::FONT_FACES)
        .map(|(family, face)| {
            format!(
                "@font-face {{\n  font-family: \"{family}\";\n  font-style: normal;\n  font-weight: 100 900;\n  font-display: swap;\n  src: url(\"{}\") format(\"woff2\");\n}}\n\n",
                routes::relative(&source, &namespace::viewer(face))
            )
        })
        .collect();
    faces + STYLES
}

#[cfg(test)]
#[path = "_tests_/document_style_tests.rs"]
mod document_style_tests;
