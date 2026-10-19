//! Authored nesting uses heap frames in each Mokly-owned scanner.

use std::thread;

use crate::error::{CssError, TransformFailure};
use crate::{
    css_boundaries, module_checks, module_integrity, modules, rename, rule_syntax, rule_walk,
    syntax,
};

fn small_stack(test: fn()) {
    thread::Builder::new()
        .stack_size(256 * 1024)
        .spawn(test)
        .unwrap()
        .join()
        .unwrap();
}

#[test]
fn deep_references_keep_asset_ranges_and_import_order() {
    small_stack(|| {
        let nested = format!("{}url(\"image.svg\"){}", "f(".repeat(512), ")".repeat(512));
        let source = format!("@import 'first.css';a{{--x:{nested}}}@import 'late.css';");
        let refs = syntax::references(&source);
        assert_eq!(refs.len(), 3);
        assert_eq!(
            refs.iter()
                .map(|item| item.value.as_str())
                .collect::<Vec<_>>(),
            ["first.css", "image.svg", "late.css"]
        );
        assert!(!refs[0].late);
        assert!(refs[0].import);
        assert_eq!(&source[refs[1].start..refs[1].end], "url(\"image.svg\")");
        assert!(!refs[1].import);
        assert!(refs[2].late);
        let (start, end) = refs[2].rule.unwrap();
        assert_eq!(&source[start..end], "@import 'late.css';");
    });
}

#[test]
fn deep_normalization_preserves_token_separators_and_opaque_selector_spaces() {
    small_stack(|| {
        let before = "f(".repeat(512);
        let after = ")".repeat(512);
        let source = format!("{before}alpha /**/ beta{after}");
        let expected = format!("{before}alpha beta{after}");
        assert_eq!(rule_syntax::normalize(&source), expected);
        assert_eq!(rule_syntax::opaque(&source), expected);
        assert_eq!(
            rule_syntax::opaque(&format!("{before}.a .b{after}")),
            format!("{before}.a .b{after}")
        );
    });
}

#[test]
fn deep_blocks_keep_inner_html_boundaries_and_find_forbidden_module_rules() {
    small_stack(|| {
        let body = format!(
            "{}a{{content:'-->'}}{}",
            "@media all{".repeat(512),
            "}".repeat(512)
        );
        assert_eq!(css_boundaries::strip(&format!("<!--{body}-->")), body);
        module_checks::check("deep.css", &body).unwrap();
        let invalid = body.replace("a{content:'-->'}", "@value theme: red;");
        let error = module_checks::check("deep.css", &invalid).unwrap_err();
        assert!(matches!(
            error,
            CssError::Transform {
                kind: TransformFailure::Modules,
                ..
            }
        ));
        assert!(
            error
                .to_string()
                .contains("CSS Modules @value is unsupported in deep.css:")
        );
    });
}

#[test]
fn deep_module_rule_and_body_frames_preserve_every_unrelated_byte() {
    small_stack(|| {
        let class = modules::scoped_name("deep.css", "a");
        for open in ["@media all{", ".a{"] {
            let source = format!("{}.a{{color:red}}{}", open.repeat(512), "}".repeat(512));
            let scoped = rename::scope("deep.css", &source).unwrap();
            assert_eq!(scoped.css, source.replace(".a", &format!(".{class}")));
            assert_eq!(scoped.exports["a"], class);
            module_integrity::check("deep.css", &source, &scoped.css).unwrap();
            assert!(
                module_integrity::check(
                    "deep.css",
                    &source,
                    &scoped.css.replace("color:red", "color:blue")
                )
                .is_err()
            );
        }
    });
}

#[test]
fn deep_module_wrappers_and_keyframes_keep_local_names() {
    small_stack(|| {
        let class = modules::scoped_name("deep.css", "a");
        let wrapped = format!(
            "{}.a{}{{color:red}}",
            ":local(".repeat(512),
            ")".repeat(512)
        );
        let scoped = rename::scope("deep.css", &wrapped).unwrap();
        assert_eq!(scoped.css, format!(".{class}{{color:red}}"));
        module_integrity::check("deep.css", &wrapped, &scoped.css).unwrap();
        let keyframes = format!(
            "@keyframes {}spin{}{{from{{opacity:0}}}}",
            ":local(".repeat(512),
            ")".repeat(512)
        );
        let scoped = rename::scope("deep.css", &keyframes).unwrap();
        assert_eq!(
            scoped.css,
            format!(
                "@keyframes {}{{from{{opacity:0}}}}",
                modules::scoped_name("deep.css", "spin")
            )
        );
        module_integrity::check("deep.css", &keyframes, &scoped.css).unwrap();
    });
}

#[test]
fn integrity_checks_the_innermost_function_value() {
    small_stack(|| {
        let source = format!(".a{{--x:{}one{}}}", "f(".repeat(512), ")".repeat(512));
        module_integrity::check("deep.css", &source, &source).unwrap();
        assert!(
            module_integrity::check("deep.css", &source, &source.replace("one", "two")).is_err()
        );
    });
}

#[test]
fn rule_walk_keeps_all_nested_conditions_and_the_leaf_declaration() {
    small_stack(|| {
        let source = format!(
            "{}a{{color:red}}{}",
            "@media all{".repeat(256),
            "}".repeat(256)
        );
        let mut rules = Vec::new();
        rule_walk::walk(&source, &mut rules).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].conditions.len(), 256);
        assert_eq!(rules[0].selectors, ["a"]);
        assert_eq!(rules[0].declarations, "color:red");
    });
}
