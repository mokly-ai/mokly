//! Check the section grammar table against lightningcss parser behaviour.

use lightningcss::stylesheet::{ParserOptions, PrinterOptions, StyleSheet};

use crate::error::{CssError, TransformFailure};
use crate::modules::{scope, scoped_name};
use crate::token_grammar::nested;
use crate::token_sections::{Grammar, Statement};

/// The block at-rules and valid preludes handled by lightningcss.
const AT_RULES: &[(&str, &str)] = &[
    ("media", "all"),
    ("supports", "(display:grid)"),
    ("container", "(min-width:1px)"),
    ("layer", "l"),
    ("scope", "(.s)"),
    ("starting-style", ""),
    ("-moz-document", "url-prefix()"),
    ("font-face", ""),
    ("font-feature-values", "Font"),
    ("font-palette-values", "--p"),
    ("counter-style", "c"),
    ("viewport", ""),
    ("-ms-viewport", ""),
    ("keyframes", "k"),
    ("-webkit-keyframes", "k"),
    ("-moz-keyframes", "k"),
    ("-o-keyframes", "k"),
    ("-ms-keyframes", "k"),
    ("page", ""),
    ("view-transition", ""),
    ("property", "--x"),
    ("position-try", "--t"),
    ("nest", "&"),
    ("foo", "x"),
];

/// Outside a style rule, `@-moz-document` reads as a style block here.
/// lightningcss parses a rule list in these two contexts.
const PARSER_EXCEPTIONS: &[(Grammar, &str)] = &[
    (Grammar::Stylesheet, "-moz-document"),
    (Grammar::Rules, "-moz-document"),
];

fn source(context: Grammar, name: &str, prelude: &str, body: &str) -> String {
    let at_rule = format!("@{name} {prelude}").trim_end().to_owned();
    let statement = format!("{at_rule}{{{body}}}");
    match context {
        Grammar::Stylesheet => statement,
        Grammar::Rules => format!("@media all{{{statement}}}"),
        Grammar::Style => format!(".p{{{statement}}}"),
        Grammar::Lenient => format!("@keyframes k{{{statement}}}"),
        Grammar::Declarations => unreachable!("not a probe context"),
    }
}

fn parses_probe(context: Grammar, name: &str, prelude: &str, body: &str, marker: &str) -> bool {
    StyleSheet::parse(
        &source(context, name, prelude, body),
        ParserOptions::default(),
    )
    .ok()
    .and_then(|sheet| sheet.to_css(PrinterOptions::default()).ok())
    .is_some_and(|result| result.code.contains(marker))
}

fn expected(declaration: bool, rule: bool) -> &'static [Grammar] {
    match (declaration, rule) {
        (true, true) => &[Grammar::Style],
        (false, true) => &[Grammar::Rules],
        _ => &[Grammar::Lenient, Grammar::Declarations],
    }
}

fn is_exception(context: Grammar, name: &str) -> bool {
    PARSER_EXCEPTIONS
        .iter()
        .any(|(exception_context, exception_name)| {
            *exception_context == context && *exception_name == name
        })
}

/// The grammar table matches parser output for every block at-rule.
#[test]
fn nested_matches_lightningcss_block_at_rules() {
    let contexts = [
        Grammar::Stylesheet,
        Grammar::Rules,
        Grammar::Style,
        Grammar::Lenient,
    ];
    let mut mismatches = Vec::new();
    let mut checked_exceptions = Vec::new();
    for context in contexts {
        for &(name, prelude) in AT_RULES {
            let declaration = parses_probe(context, name, prelude, "color:red", "color: red;");
            let rule = parses_probe(context, name, prelude, ".a{color:red}", ".a {");
            let expected = expected(declaration, rule);
            let actual = nested(context, &Statement::AtRule(name.to_owned()));
            if is_exception(context, name) {
                checked_exceptions.push((context, name));
                if expected != [Grammar::Rules] || actual != Grammar::Style {
                    mismatches.push(format!(
                        "stale exception for @{name} in {context:?}: expected {expected:?}, actual {actual:?}"
                    ));
                }
            } else if !expected.contains(&actual) {
                mismatches.push(format!(
                    "@{name} in {context:?}: expected {expected:?}, actual {actual:?}"
                ));
            }
        }
    }
    for &(context, name) in PARSER_EXCEPTIONS {
        if !checked_exceptions.contains(&(context, name)) {
            mismatches.push(format!(
                "unchecked parser exception for @{name} in {context:?}"
            ));
        }
    }
    assert!(
        mismatches.is_empty(),
        "grammar mismatches:\n{}",
        mismatches.join("\n")
    );
}

/// `@nest` keeps nested local selectors and reports empty local wrappers.
#[test]
fn nest_scopes_nested_selectors_and_reports_empty_wrapper() {
    let path = "ui/nest.module.css";
    let error = scope(path, ".p{@nest &{:local()}}").unwrap_err();
    let CssError::Transform { kind, message } = error else {
        panic!("expected a transform failure: {error}");
    };
    assert_eq!(kind, TransformFailure::Modules, "{message}");
    assert_eq!(
        message,
        "CSS Modules :local() has no selector in ui/nest.module.css:1:12; add a selector inside it or remove it"
    );

    let (css, exports) = scope(path, ".p{@nest &{.a{color:red}}}").unwrap();
    let p = scoped_name(path, "p");
    let a = scoped_name(path, "a");
    assert!(css.contains(&format!(".{p}")), "{css}");
    assert!(css.contains(&format!(".{a}")), "{css}");
    assert_eq!(exports.get("p").map(String::as_str), Some(p.as_str()));
    assert_eq!(exports.get("a").map(String::as_str), Some(a.as_str()));
    assert_eq!(exports.len(), 2);
}
