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
        let new = pipeline::authored_document(source, "fixture.html", 1, 1);
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

#[test]
fn formatting_clones_do_not_take_a_later_start_tag_position() {
    let source = "<p><b class=one>1</p><p><b class=two>2</b></p>";
    let nodes = crate::parse::authored_document(source, "fixture.html");
    let positions: Vec<_> = tree::walk(&nodes)
        .filter_map(|node| match node {
            crate::tree::Node::Element(element) if element.name == "b" => element
                .source
                .as_ref()
                .map(|source| (element.get("class"), source.column)),
            _ => None,
        })
        .collect();
    assert_eq!(positions, vec![(Some("one"), 4), (Some("two"), 25)]);
}

#[test]
fn reconstruction_positions_follow_each_authored_start_tag() {
    for (source, name, expected) in [
        (
            "<p><a href=one>1<div>2<a href=two>3</a></div>",
            "a",
            vec![(Some("one"), 4), (Some("two"), 23)],
        ),
        (
            "<p><nobr class=one>one</p><p><nobr class=two>two</nobr></p>",
            "nobr",
            vec![(Some("one"), 4), (Some("two"), 30)],
        ),
        (
            "<table><b class=one>one</table><b class=two>two",
            "b",
            vec![(Some("one"), 8), (Some("two"), 32)],
        ),
    ] {
        let nodes = crate::parse::authored_fragment(source, "fixture.html");
        let positions: Vec<_> = tree::walk(&nodes)
            .filter_map(|node| match node {
                crate::tree::Node::Element(element) if element.name == name => {
                    element.source.as_ref().map(|source| {
                        (
                            element.get("href").or_else(|| element.get("class")),
                            source.column,
                        )
                    })
                }
                _ => None,
            })
            .collect();
        assert_eq!(positions, expected, "{source}");
    }
}

#[test]
fn token_pipeline_copies_bom_and_cdata_boundaries() {
    for source in [
        "\u{feff}<!doctype html><html><head><title>Title</title></head><body>Body</body></html>",
        "<svg><![CDATA[foreign text]]></svg>",
    ] {
        let old = crate::parse::legacy_authored_document(source);
        let new = pipeline::delivered_document(source);
        assert_eq!(serialize::html(&new), serialize::html(&old), "{source:?}");
    }
}

#[test]
fn cdata_question_follows_buffered_foreign_text() {
    let source = "<math><mi><p><b>1</p>2<![CDATA[3]]>";
    let nodes = crate::parse::delivered_fragment(source);
    let actual = crate::serialize::html(&nodes);
    assert_eq!(
        actual,
        "<math><mi><p><b>1</b></p><b>2<!--[CDATA[3]]--></b></mi></math>"
    );
}
