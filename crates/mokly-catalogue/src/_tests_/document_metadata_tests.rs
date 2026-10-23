//! Title inference uses the same visible Markdown text as document composition.

use crate::documents::parse;

#[test]
fn title_inference_keeps_literal_html_and_removes_gfm_formatting() {
    for (body, title) in [
        ("# <b>Literal</b>\n", "<b>Literal</b>"),
        ("# ~~First~~ `real`\n", "First real"),
        ("# \n\n## Second &amp; last\n", "Second & last"),
        ("No heading\n", "Guide"),
    ] {
        let parsed = parse(body.into(), "specs/guide.md").unwrap();
        assert_eq!(parsed.input.title, title);
    }
}
