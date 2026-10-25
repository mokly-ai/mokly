//! Differential probes for the token-driven parser.

use crate::{pipeline, serialize, tree};

#[test]
fn token_pipeline_keeps_tree_bytes_and_source_identity() {
    for (source, expected) in [
        ("<p>Hello &amp; <b>world</b></p>", vec!["p", "b"]),
        (
            "<table>outside<tr><td>cell</td></tr></table>",
            vec!["table", "tr", "td"],
        ),
        (
            "<svg><foreignObject><p>HTML</p></foreignObject></svg>",
            vec!["svg", "foreignObject", "p"],
        ),
        ("<textarea><b>raw</b></textarea>", vec!["textarea"]),
        ("<plaintext><b>literal</b>", vec!["plaintext"]),
    ] {
        let old = crate::parse::legacy_authored_document(source);
        let new = pipeline::document(source, "fixture.html");
        assert_eq!(serialize::html(&new), serialize::html(&old), "{source}");
        let identities: Vec<_> = tree::walk(&new)
            .filter_map(|node| match node {
                crate::tree::Node::Element(element) => {
                    Some((element.name.clone(), element.source.clone()))
                }
                _ => None,
            })
            .collect();
        for name in expected {
            assert!(tree::walk(&new).any(|node| {
                matches!(node, crate::tree::Node::Element(element) if element.name == name && element.source.is_some())
            }), "missing source for {name}: {identities:?}");
        }
    }
}
