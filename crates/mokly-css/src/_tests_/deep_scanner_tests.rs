//! Mokly's CSS scanners keep authored nesting on the heap.
//!
//! Each test runs on a 64 KiB thread, far below the 2 MiB worker stacks, with
//! nesting that a recursive scanner could not survive on that stack.

use std::thread;

use crate::error::{CssError, TransformFailure};
use crate::rules::{ConditionKind, Rule};
use crate::{
    css_boundaries, module_checks, module_integrity, modules, rename, rule_syntax, rule_walk,
    syntax,
};

const STACK: usize = 64 * 1024;
const DEPTH: usize = 100_000;

fn small_stack(test: fn()) {
    thread::Builder::new()
        .stack_size(STACK)
        .spawn(test)
        .unwrap()
        .join()
        .unwrap();
}

fn nested(open: &str, inner: &str, close: &str, depth: usize) -> String {
    format!("{}{inner}{}", open.repeat(depth), close.repeat(depth))
}

#[test]
fn references_keep_ranges_and_import_order_inside_deep_functions() {
    small_stack(|| {
        let value = nested("f(", "url(\"deep.svg\")", ")", DEPTH);
        let source = format!("@import 'first.css';a{{--x:{value}}}@import 'late.css';");
        let references = syntax::references(&source);
        let values: Vec<_> = references.iter().map(|item| item.value.as_str()).collect();
        assert_eq!(values, ["first.css", "deep.svg", "late.css"]);
        assert!(references[0].import && !references[0].late);
        let deep = &references[1];
        assert_eq!(&source[deep.start..deep.end], "url(\"deep.svg\")");
        assert!(!deep.import);
        let (start, end) = references[2].rule.unwrap();
        assert!(references[2].late);
        assert_eq!(&source[start..end], "@import 'late.css';");
    });
}

#[test]
fn normalization_keeps_separators_inside_deep_blocks() {
    small_stack(|| {
        let source = nested("f(", "alpha /**/ beta", ")", DEPTH);
        let expected = nested("f(", "alpha beta", ")", DEPTH);
        assert_eq!(rule_syntax::normalize(&source), expected);
        assert_eq!(rule_syntax::opaque(&source), expected);
        let selector = nested("[", ".a .b", "]", DEPTH);
        assert_eq!(rule_syntax::opaque(&selector), selector);
    });
}

#[test]
fn boundaries_strip_only_top_level_html_comments_around_deep_blocks() {
    small_stack(|| {
        let body = nested("a{", "content:'<!--';x:<!--", "}", DEPTH);
        let stripped = css_boundaries::strip(&format!("<!--{body}-->"));
        assert_eq!(stripped, body);
    });
}

#[test]
fn module_checks_find_a_deep_value_rule_after_custom_property_blocks() {
    small_stack(|| {
        let allowed = nested("@media all{", "--x:{@value y;}a{color:red}", "}", DEPTH);
        module_checks::check("deep.css", &allowed).unwrap();
        let rejected = nested("@media all{", "\n@value theme: red;", "}", DEPTH);
        let error = module_checks::check("deep.css", &rejected).unwrap_err();
        assert!(matches!(
            error,
            CssError::Transform {
                kind: TransformFailure::Modules,
                ..
            }
        ));
        let location = format!("deep.css:1:{}", "@media all{".len() * DEPTH + 1);
        assert!(error.to_string().contains(&location), "{error}");
    });
}

#[test]
fn deep_grouping_rules_scope_the_innermost_class() {
    small_stack(|| {
        let source = nested("@media all{", ".a{color:red}", "}", DEPTH);
        let class = modules::scoped_name("deep.css", "a");
        let scoped = rename::scope("deep.css", &source).unwrap();
        assert_eq!(scoped.css, source.replace(".a{", &format!(".{class}{{")));
        assert_eq!(scoped.exports["a"], class);
        module_integrity::check("deep.css", &source, &scoped.css).unwrap();
        let changed = scoped.css.replace("color:red", "color:blue");
        assert!(module_integrity::check("deep.css", &source, &changed).is_err());
    });
}

#[test]
fn deep_nested_rules_and_wrappers_scope_every_local_name() {
    small_stack(|| {
        let depth = 10_000;
        let class = modules::scoped_name("deep.css", "a");
        let rules = nested(".a{", "color:red", "}", depth);
        let scoped = rename::scope("deep.css", &rules).unwrap();
        assert_eq!(scoped.css, rules.replace(".a", &format!(".{class}")));
        module_integrity::check("deep.css", &rules, &scoped.css).unwrap();
        let wrapped = format!("{}{{color:red}}", nested(":local(", ".a", ")", depth));
        let scoped = rename::scope("deep.css", &wrapped).unwrap();
        assert_eq!(scoped.css, format!(".{class}{{color:red}}"));
        module_integrity::check("deep.css", &wrapped, &scoped.css).unwrap();
        let keyframes = format!(
            "@keyframes {}{{to{{opacity:0}}}}",
            nested(":local(", "spin", ")", depth)
        );
        let scoped = rename::scope("deep.css", &keyframes).unwrap();
        let spin = modules::scoped_name("deep.css", "spin");
        assert_eq!(scoped.css, format!("@keyframes {spin}{{to{{opacity:0}}}}"));
        module_integrity::check("deep.css", &keyframes, &scoped.css).unwrap();
    });
}

#[test]
fn integrity_compares_the_innermost_function_argument() {
    small_stack(|| {
        let source = format!(".a{{--x:{}}}", nested("f(", "one", ")", DEPTH));
        module_integrity::check("deep.css", &source, &source).unwrap();
        let changed = source.replace("one", "two");
        assert!(module_integrity::check("deep.css", &source, &changed).is_err());
    });
}

#[test]
fn rule_walk_keeps_every_nested_condition_and_the_leaf_declaration() {
    thread::Builder::new()
        .stack_size(4 * STACK)
        .spawn(|| {
            let depth = 2_000;
            let source = nested("@media all{", "a{color:red}", "}", depth);
            let mut rules: Vec<Rule> = Vec::new();
            rule_walk::walk(&source, &mut rules).unwrap();
            assert_eq!(rules.len(), 1);
            assert_eq!(rules[0].conditions.len(), depth);
            assert!(
                rules[0]
                    .conditions
                    .iter()
                    .all(|condition| condition.kind == ConditionKind::Media)
            );
            assert_eq!(rules[0].selectors, ["a"]);
            assert_eq!(rules[0].declarations, "color:red");
        })
        .unwrap()
        .join()
        .unwrap();
}
