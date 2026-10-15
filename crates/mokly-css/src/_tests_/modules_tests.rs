//! Scoped names depend on paths while unrelated CSS identities stay global.

use crate::modules::scope;

#[test]
fn modules_scope_only_local_class_id_and_animation_names() {
    let source = ".base { color: red; }\n.card { composes: base; animation: pulse 1s; --color: blue; grid-area: main; container-name: card; view-transition-name: page; list-style: special; }\n#item { color: var(--color); }\n:global(.global) :local(.local) { opacity: .5; }\n@keyframes pulse { to { opacity: 0; } }\n@counter-style special { system: cyclic; symbols: x; }\n";
    let (css, exports) = scope("ui/card.module.css", source).unwrap();
    assert!(css.contains("grid-area: main"));
    assert!(css.contains("container-name: card"));
    assert!(css.contains("--color: blue"));
    assert!(css.contains("view-transition-name: page"));
    assert!(css.contains("@counter-style special"));
    assert!(css.contains(".global"));
    assert!(!exports.contains_key("global"));
    assert_eq!(exports["card"].split_whitespace().count(), 2);
    assert!(exports["card"].ends_with(&exports["base"]));
    insta::assert_snapshot!("scoped_css", css);
    insta::assert_snapshot!("class_map", serde_json::to_string_pretty(&exports).unwrap());
    let (_, edited) = scope("ui/card.module.css", &source.replace("red", "blue")).unwrap();
    assert_eq!(exports, edited);
    let (_, moved) = scope("moved/card.module.css", source).unwrap();
    assert_ne!(exports, moved);
}

#[test]
fn unsupported_modules_extensions_and_forward_compositions_fail() {
    for source in [
        "@value color: red;",
        ":import('./x.css') { x: y }",
        ":export { x: y }",
        ".x { composes: later; } .later { color: red }",
        ".x:hover { composes: x; }",
        ":global() { color: red }",
        ":local() { color: red }",
    ] {
        assert!(scope("card.module.css", source).is_err(), "{source}");
    }
    let (css, exports) = scope("card.module.css", ".x { composes: utility from global; }").unwrap();
    assert!(exports["x"].ends_with(" utility"));
    assert!(!css.contains("composes"));
}

#[test]
fn scoping_preserves_comments_spacing_modern_syntax_and_animation_priority() {
    let source = "/* keep */\n.base{color:red}\n.card { composes: base base; opacity:.5; animation: pulse 2s linear !important; --value: 1.00; }\n@scope (.outer) to (:global(.stop)) { .inner { color:var(--value); } }\n:global .app :local .local { grid-area:main }\n@keyframes pulse { to { opacity:0 } }\n@keyframes \"quoted\" { to { opacity:0 } }\n.quoted {animation-name: \"quoted\" !important}\n";
    let (css, exports) = scope("ui/modern.module.css", source).unwrap();
    assert!(css.starts_with("/* keep */\n"));
    assert!(css.contains("opacity:.5"));
    assert!(css.contains("--value: 1.00"));
    assert!(css.contains("linear !important"));
    assert!(css.contains(".stop"));
    assert!(exports.contains_key("outer"));
    assert!(exports.contains_key("inner"));
    assert!(!exports.contains_key("app"));
    assert!(exports.contains_key("local"));
    assert_eq!(exports["card"].split_ascii_whitespace().count(), 3);
    insta::assert_snapshot!("rename_only", css);
}
