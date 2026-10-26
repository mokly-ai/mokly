//! Differential probes for the token-driven parser.

use crate::{pipeline, serialize, tree};

#[test]
fn duplicate_attributes_keep_the_first_value_in_authored_and_delivered_trees() {
    for (source, expected_name, attribute, expected) in [
        ("<p title='a' title='b'></p>", "p", "title", "a"),
        (
            "<x-card tone='one' tone='two'></x-card>",
            "x-card",
            "tone",
            "one",
        ),
        (
            "<img src='first.svg' src='second.svg'>",
            "img",
            "src",
            "first.svg",
        ),
    ] {
        for nodes in [
            crate::parse::delivered_fragment(source),
            crate::parse::authored_fragment(source, "fixture.html"),
        ] {
            let element = tree::walk(&nodes)
                .find_map(|node| match node {
                    crate::tree::Node::Element(element) if element.name == expected_name => {
                        Some(element)
                    }
                    _ => None,
                })
                .expect("test element");
            assert_eq!(element.get(attribute), Some(expected));
            assert_eq!(
                element
                    .attributes
                    .iter()
                    .filter(|value| value.name == attribute)
                    .count(),
                1
            );
        }
    }
}

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
