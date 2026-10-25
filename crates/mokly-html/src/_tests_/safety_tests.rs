//! Markdown output is literal and the final safety boundary rejects injected markup.

use mokly_model::axes::ColorScheme;
use unimock::{MockFn, Unimock, matching};

use crate::markdown::{Destination, LinkResolverMock, render};
use crate::{parse, safety, serialize};

#[test]
fn raw_html_is_literal_and_heading_ids_skip_earlier_suffixes() {
    let resolver = Unimock::new(
        LinkResolverMock::resolve
            .each_call(matching!(_))
            .answers(&|_, value| Ok(Destination::Url(value.into()))),
    );
    let body = "# Guide\n# Guide-2\n# Guide\n# !!!\n# Café_文\n\n- [x] Done\n\n| A | B |\n| :- | -: |\n| 1 | 2 |\n\n<script onclick=\"run()\">literal</script>\n\n**Later prose** [External](https://example.com/a)\n";
    for scheme in [ColorScheme::Light, ColorScheme::Dark] {
        let tree = render(body, "Guide", scheme, &resolver).unwrap();
        safety::validate(&tree).unwrap();
        let html = serialize::html(&tree);
        assert!(html.contains("id=\"guide-3\""));
        assert!(html.contains("id=\"café_文\""));
        assert!(!html.contains("<script"));
        assert!(html.contains("&lt;script"));
        insta::assert_snapshot!(format!("markdown_{scheme:?}"), html);
    }
}

#[test]
fn unsafe_final_markup_and_outer_wrapper_events_are_rejected_independently() {
    for body in [
        "<script>run()</script>",
        "<iframe></iframe>",
        "<svg></svg>",
        "<p style=\"color:red\">bad</p>",
        "<p onclick=\"go()\">bad</p>",
        "<input type=\"checkbox\">",
        "<input disabled type=\"text\">",
        "<a href=\"javascript:run()\">bad</a>",
        "<img src=\"//host/image.png\">",
        "<a href=\"/absolute\">bad</a>",
    ] {
        let document = format!(
            "<!doctype html><html lang=\"en\" style=\"color-scheme: light\"><head><title>Safe</title><style>p{{color:red}}</style></head><body><main>{body}</main></body></html>"
        );
        assert!(
            safety::validate(&parse::delivered_document(&document)).is_err(),
            "{body}"
        );
    }
    let document = "<!doctype html><html lang=\"en\" style=\"color-scheme: light\"><head><style>p{}</style></head><body><html onload=\"run()\"><main>Text</main></body></html>";
    assert!(safety::validate(&parse::delivered_document(document)).is_err());
}

#[test]
fn gfm_autolinks_keep_code_and_explicit_link_labels_literal() {
    let resolver = Unimock::new(
        LinkResolverMock::resolve
            .each_call(matching!(_))
            .answers(&|_, value| Ok(Destination::Url(value.into()))),
    );
    let tree = render("Visit https://example.com/a, www.example.com, or reader@example.com. `https://code.example` [https://label.example](https://target.example).", "Links", ColorScheme::Light, &resolver).unwrap();
    safety::validate(&tree).unwrap();
    let html = serialize::html(&tree);
    assert!(html.contains("href=\"https://example.com/a\""));
    assert!(html.contains("href=\"http://www.example.com\""));
    assert!(html.contains("href=\"mailto:reader@example.com\""));
    assert!(html.contains("<code>https://code.example</code>"));
    assert!(!html.contains("href=\"https://label.example\""));
}

#[test]
fn markdown_safety_uses_scheme_position_for_url_colons() {
    let resolver = Unimock::new(
        LinkResolverMock::resolve
            .each_call(matching!(_))
            .answers(&|_, value| Ok(Destination::Url(value.into()))),
    );
    let tree = render(
        "[Fragment](#x:y) [Query](?t=10:30) [Path](./images/a:b.svg)",
        "Links",
        ColorScheme::Light,
        &resolver,
    )
    .unwrap();
    safety::validate(&tree).unwrap();
}
