//! Arena sink regressions cover foster parenting, templates, foreign content, and text merging.

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
