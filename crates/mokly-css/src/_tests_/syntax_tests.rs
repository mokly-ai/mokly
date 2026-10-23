//! CSS token references handle strings, nested functions, comments, and late imports.

use crate::paths;
use crate::syntax::references;

#[test]
fn token_references_distinguish_local_image_strings_and_real_urls() {
    let source = "/* url(fake.png) */ @import url('./tokens.css') layer(theme); .x { content: 'url(fake.png)'; background: image-set(url(\"a.png?x#hash\") 1x, 'b.png' 2x); mask: url(#id); } @import './late.css'";
    let references = references(source);
    assert_eq!(
        references
            .iter()
            .map(|reference| reference.value.as_str())
            .collect::<Vec<_>>(),
        ["./tokens.css", "a.png?x#hash", "b.png", "#id", "./late.css"]
    );
    assert!(references[0].import);
    assert!(!references[0].late);
    assert!(references[2].image_set_string);
    assert!(references[4].late);
    assert!(references[4].rule.is_some());
}

#[test]
fn asset_route_grammar_keeps_scopes_and_rejects_device_names_and_escapes() {
    for path in [
        "images/card.svg",
        "node_modules/@scope/fonts/a.woff2",
        "images/foo~bar.png",
    ] {
        assert!(paths::portable(path, true), "{path}");
    }
    for path in [
        "../x.png",
        "images/aux.png",
        "images/a b.png",
        "@scope/a.png",
        "images/a.PNG.",
        "images/.hidden.png",
        "images/_private.png",
        "node_modules/@scope/nul.woff2",
    ] {
        assert!(!paths::portable(path, true), "{path}");
    }
    assert!(paths::portable("styles/_root.css", false));
    assert!(paths::content_type("a.PNG").is_none());
    assert!(paths::external("DATA:image/png;base64,AA"));
}

#[test]
fn legacy_css_reference_boundaries_keep_escapes_comments_and_image_sets() {
    for (source, expected) in [
        ("color: red; padding: 2px", vec![]),
        ("color: var(--tone); transform: translateX(0px)", vec![]),
        (r"background: u\72l(icon.svg)", vec!["icon.svg"]),
        (r#"@\69mport "theme.css";"#, vec!["theme.css"]),
        ("a { background: url(a/*/b.svg); }", vec!["a/*/b.svg"]),
        (r#"a { background: url("a/*b.svg"); }"#, vec!["a/*b.svg"]),
        (
            r#"a { background: url("a/*comment*/b.svg"); }"#,
            vec!["a/*comment*/b.svg"],
        ),
        (
            "a { background: /* asset */url(image.svg); }",
            vec!["image.svg"],
        ),
        (
            r#"@import /* import */ "theme/*night*/tokens.css";"#,
            vec!["theme/*night*/tokens.css"],
        ),
        (
            r#"a { content: "url(fake.svg)"; background: url/**/("fake.svg"); }"#,
            vec![],
        ),
        (
            r#"@import url("theme.css"); a { background: URL(icon.svg); }"#,
            vec!["theme.css", "icon.svg"],
        ),
        (
            "a { background: url(icon.svg); } /* unclosed",
            vec!["icon.svg"],
        ),
        (
            r#"a{background:image-set("a.png" 1x, url("b.png") 2x)}"#,
            vec!["a.png", "b.png"],
        ),
    ] {
        assert_eq!(
            references(source)
                .iter()
                .map(|item| item.value.as_str())
                .collect::<Vec<_>>(),
            expected,
            "{source}"
        );
    }
}
