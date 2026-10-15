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
