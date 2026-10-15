//! Arena sink regressions cover foster parenting, templates, foreign content, and text merging.

use crate::tree::Node;
use crate::{parse, serialize};

#[test]
fn arena_sink_preserves_html5_moves_namespaces_and_template_contents() {
    for (source, expected) in [
        (
            "<table>outside<tr><td>One</td></tr></table>",
            "outside<table><tbody><tr><td>One</td></tr></tbody></table>",
        ),
        (
            "<template><p>A &amp; B</p></template>",
            "<template><p>A &amp; B</p></template>",
        ),
        (
            "<select><option>One<option>Two</select>",
            "<select><option>One</option><option>Two</option></select>",
        ),
        (
            "<svg><foreignObject><p>HTML</p></foreignObject></svg>",
            "<svg><foreignObject><p>HTML</p></foreignObject></svg>",
        ),
        (
            "<math><annotation-xml encoding=\"text/html\"><div>HTML</div></annotation-xml></math>",
            "<math><annotation-xml encoding=\"text/html\"><div>HTML</div></annotation-xml></math>",
        ),
        (
            "<noscript><p>Enable JS</p></noscript>",
            "<noscript><p>Enable JS</p></noscript>",
        ),
    ] {
        assert_eq!(serialize::html(&parse::fragment(source)), expected);
    }
}

#[test]
fn adoption_agency_reconstructs_misnested_formatting_elements() {
    assert_eq!(
        serialize::html(&parse::fragment("<p><b>one<i>two</b>three</i>four</p>")),
        "<p><b>one<i>two</i></b><i>three</i>four</p>"
    );
}

#[test]
fn foster_parented_text_merges_with_the_previous_text_node() {
    let nodes = parse::fragment("a<table>b<tr><td>x</td></tr>c</table>d");
    assert!(matches!(nodes.first(), Some(Node::Text(text)) if text == "abc"));
    assert_eq!(
        serialize::html(&nodes),
        "abc<table><tbody><tr><td>x</td></tr></tbody></table>d"
    );
}

#[test]
fn repeated_html_and_body_tags_keep_first_values_and_merge_new_attributes() {
    let nodes = parse::document(
        "<html lang=\"en\"><html lang=\"fr\" dir=\"rtl\"><head></head><body class=\"one\"><body class=\"two\" id=\"extra\">Text</body></html>",
    );
    assert_eq!(
        serialize::html(&nodes),
        "<html lang=\"en\" dir=\"rtl\"><head></head><body class=\"one\" id=\"extra\">Text</body></html>"
    );
}
