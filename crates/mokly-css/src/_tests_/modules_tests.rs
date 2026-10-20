//! Scoped names depend on paths while unrelated CSS identities stay global.

use crate::module_integrity;
use crate::modules::{scope, scoped_name};

#[test]
fn declaration_list_at_rules_keep_local_functions_and_identifiers() {
    let source = "@font-face { font-family: Brand; src: local(\"Brand\"), url(brand.woff2) format(\"woff2\"); }\n@font-face { font-family: local; src: url(other.woff2) }\n@property --local { syntax: \"<color>\"; initial-value: red; inherits: false }\n@page { size: auto; @top-left { content: local; } }\n.x { color: red }";
    let (css, exports) = scope("fonts.module.css", source).unwrap();
    assert!(exports.contains_key("x"));
    assert_eq!(
        css.split(".mokly_").next().unwrap(),
        source.split(".x").next().unwrap()
    );
}

#[test]
fn token_guard_rejects_non_name_changes_with_the_exact_diagnostic() {
    let error = module_integrity::check(
        "fonts.module.css",
        "@font-face { src: local(\"Brand\") }",
        "@font-face { src\"Brand\" }",
    )
    .unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-css/build-invalid] CSS Modules scoping would change more than local names in fonts.module.css:1:1; move this CSS to a plain stylesheet"
    );
}

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

/// A comment before `composes` stays in the scoped text, and the
/// declaration still composes.
#[test]
fn comments_before_composes_stay_as_authored() {
    let path = "ui/compose.module.css";
    let (a, c) = (scoped_name(path, "a"), scoped_name(path, "c"));
    for (source, scoped) in [
        (".a{}.c{/**/composes:a;color:red}", "{/**/color:red}"),
        (
            ".a{}.c{color:blue; /* why */ composes: a; color:red}",
            "{color:blue; /* why */  color:red}",
        ),
        (".a{}.c{color:red;/**/composes:a}", "{color:red;/**/}"),
    ] {
        let (css, exports) = scope(path, source).unwrap();
        assert_eq!(css, format!(".{a}{{}}.{c}{scoped}"));
        assert_eq!(exports["c"], format!("{c} {a}"));
    }
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

#[test]
fn names_after_attribute_selectors_keep_their_own_source_ranges() {
    let path = "ui/form.module.css";
    let class = |local| scoped_name(path, local);
    for (source, expected) in [
        (".a[x]:global(.b){}", format!(".{}[x].b{{}}", class("a"))),
        (
            ".a[data-x]#main{}",
            format!(".{}[data-x]#{}{{}}", class("a"), class("main")),
        ),
        (
            "[type=text]:local(.field){}",
            format!("[type=text].{}{{}}", class("field")),
        ),
    ] {
        assert_eq!(scope(path, source).unwrap().0, expected, "{source}");
    }
    let error = scope(path, ".a[x]:export{}").unwrap_err();
    assert!(
        error.to_string().contains(&format!("{path}:1:6: :export")),
        "{error}"
    );
}

#[test]
fn custom_property_values_keep_their_blocks_to_the_semicolon() {
    let path = "ui/mixin.module.css";
    let class = |local| format!(".{}{{", scoped_name(path, local));
    let spin = scoped_name(path, "spin");
    for (source, locals) in [
        (".a{--m:{animation:spin};}@keyframes spin{to{opacity:0}}", 2),
        (".a{--a:{x} --b:{.c{color:red}};}", 1),
        (".b{color:red}.a{--mixin:{color:blue} composes: b;}", 2),
        (".b{color:red}.a{--m:{composes:b};}", 2),
        (".a{--x:{a} @value y;}", 1),
    ] {
        let (css, exports) = scope(path, source).unwrap();
        let expected = source
            .replace(".a{", &class("a"))
            .replace(".b{", &class("b"))
            .replace("@keyframes spin", &format!("@keyframes {spin}"));
        assert_eq!(css, expected, "{source}");
        assert_eq!(exports.len(), locals, "{source}");
        assert_eq!(exports["a"], scoped_name(path, "a"), "{source}");
    }
    let error = scope(path, ".a{--x:{a};@value y;}").unwrap_err();
    assert!(
        error.to_string().contains(&format!("{path}:1:12;")),
        "{error}"
    );
}

/// Nested wrappers in a keyframes name work as in a selector: the innermost
/// wrapper decides, and an empty inner wrapper fails.
#[test]
fn keyframes_names_follow_nested_wrappers_as_selectors_do() {
    let path = "ui/motion.module.css";
    let spin = scoped_name(path, "spin");
    let (css, exports) = scope(path, "@keyframes :global(:local(spin)){to{opacity:0}}").unwrap();
    assert_eq!(css, format!("@keyframes {spin}{{to{{opacity:0}}}}"));
    assert_eq!(exports.keys().collect::<Vec<_>>(), ["spin"]);
    let (css, exports) = scope(path, "@keyframes :local(:global(spin)){to{opacity:0}}").unwrap();
    assert_eq!(css, "@keyframes spin{to{opacity:0}}");
    assert!(exports.is_empty());
    let error = scope(path, "@keyframes :global(:local()){to{opacity:0}}").unwrap_err();
    let expected = "CSS Modules :local() has no keyframes name in ui/motion.module.css:1:20";
    assert!(error.to_string().contains(expected), "{error}");
}

#[test]
fn nested_group_rules_scope_animation_names_like_their_rule() {
    let path = "ui/motion.module.css";
    let source = "@keyframes spin{to{opacity:0}}.a{@media (min-width:1px){animation:spin 1s}}";
    let (css, _) = scope(path, source).unwrap();
    let spin = scoped_name(path, "spin");
    let expected = source
        .replace("spin", &spin)
        .replace(".a{", &format!(".{}{{", scoped_name(path, "a")));
    assert_eq!(css, expected);
}

#[test]
fn value_rules_report_their_own_line_and_column() {
    let source = ".a{}\n/* note */\n@value x: red;";
    let error = scope("ui/theme.module.css", source).unwrap_err();
    assert!(
        error.to_string().contains("ui/theme.module.css:3:1;"),
        "{error}"
    );
}

#[test]
fn animation_names_after_functions_keep_their_own_ranges() {
    let path = "ui/motion.module.css";
    let source = "@keyframes spin{to{opacity:0}}.a{animation:steps(4)spin 1s}";
    let (css, _) = scope(path, source).unwrap();
    let expected = source
        .replace("spin", &scoped_name(path, "spin"))
        .replace(".a{", &format!(".{}{{", scoped_name(path, "a")));
    assert_eq!(css, expected);
}

#[test]
fn nested_at_rule_preludes_stay_as_authored() {
    let path = "ui/nested.module.css";
    let class = |local| format!(".{}{{", scoped_name(path, local));
    for source in [
        ".a{@layer base.theme{color:red}}",
        ".a{@supports (color: color-mix(in srgb, #fff 50%, red)){color:red}}",
        ".a{@container style(--c:#fff){color:red}}",
        ".a{@foo .b{color:red}}",
    ] {
        let (css, exports) = scope(path, source).unwrap();
        assert_eq!(css, source.replace(".a{", &class("a")), "{source}");
        assert_eq!(exports.len(), 1, "{source}");
    }
    let source = ".a{@scope (.b) to (.c){color:red}}";
    let (css, exports) = scope(path, source).unwrap();
    let expected = source
        .replace(".a{", &class("a"))
        .replace("(.b)", &format!("(.{})", scoped_name(path, "b")))
        .replace("(.c)", &format!("(.{})", scoped_name(path, "c")));
    assert_eq!(css, expected);
    assert_eq!(exports.len(), 3);
}

#[test]
fn empty_wrappers_and_icss_fail_only_where_names_are_scoped() {
    let path = "ui/preludes.module.css";
    let class = format!(".{}{{", scoped_name(path, "a"));
    for source in [
        ".a{@supports selector(:global()){color:red}}",
        "@supports selector(:global(.b)){.a{color:red}}",
        ".a{@foo :export{color:red}}",
        "@foo :import(x){.a{color:red}}",
    ] {
        let (css, _) = scope(path, source).unwrap();
        assert_eq!(css, source.replace(".a{", &class), "{source}");
    }
    for (source, message) in [
        (
            ".a{@scope (:global()){color:red}}",
            ":global() has no selector",
        ),
        (".a :local(){color:red}", ":local() has no selector"),
        ("@scope (:export){.a{color:red}}", "authored ICSS rule"),
        (".a{@scope (:import(x)){color:red}}", "authored ICSS rule"),
        (
            "@keyframes :local() spin{to{opacity:0}}.a{animation:spin 1s}",
            ":local() has no keyframes name in ui/preludes.module.css:1:12; add the name inside it or remove it",
        ),
    ] {
        let error = scope(path, source).unwrap_err().to_string();
        assert!(error.contains(message), "{source}: {error}");
    }
}
