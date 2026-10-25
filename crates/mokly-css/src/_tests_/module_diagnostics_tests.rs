//! CSS Modules failures come from the check that owns them, at the authored
//! line and column.

use crate::module_integrity;
use crate::modules::{scope, scoped_name};

const PATH: &str = "ui/diagnostics.module.css";

/// The error message for `source`.
fn error(source: &str) -> String {
    scope(PATH, source).unwrap_err().to_string()
}

/// The line and column of a syntax failure, or `None` for another failure.
fn syntax_location(source: &str) -> Option<(usize, usize)> {
    let error = error(source);
    let prefix = format!("[mokly-css/build-invalid] could not transform CSS {PATH}:");
    let (line, rest) = error.strip_prefix(&prefix)?.split_once(':')?;
    let (column, _) = rest.split_once(':')?;
    Some((line.parse().ok()?, column.parse().ok()?))
}

/// A statement without a block in a rule list is not a rule, so the syntax
/// check reports it. The token check reads its prelude as the renamer does.
#[test]
fn statements_without_a_block_in_a_rule_list_fail_the_syntax_check() {
    for source in [".c{}.y", "@layer x{content:local;}", "@media all{.a}"] {
        assert!(
            syntax_location(source).is_some(),
            "{source:?}: {}",
            error(source)
        );
    }
    let (css, _) = scope(PATH, "@layer base;.a{color:red}").unwrap();
    assert_eq!(
        css,
        format!("@layer base;.{}{{color:red}}", scoped_name(PATH, "a"))
    );
}

/// A wrapper still open at the end of input stays as authored, so the syntax
/// check reports the unfinished stylesheet.
#[test]
fn open_wrappers_fail_the_syntax_check() {
    for source in [
        ".a :global(.b",
        ".a :local(.b",
        "@keyframes :local(spin",
        "@keyframes :global(spin",
        ".a :global(\n.q { color: red }\n",
    ] {
        assert!(
            syntax_location(source).is_some(),
            "{source:?}: {}",
            error(source)
        );
    }
}

/// CSS breaks lines at a line feed, a carriage return, a CRLF pair, and a
/// form feed, so diagnostics count lines the same way.
#[test]
fn diagnostics_count_every_css_line_break() {
    for (name, newline) in [("LF", "\n"), ("CR", "\r"), ("CRLF", "\r\n"), ("FF", "\x0C")] {
        let wrapper = format!(".a{{}}{newline}.b :global(){{}}");
        let expected = format!("has no selector in {PATH}:2:4;");
        assert!(
            error(&wrapper).contains(&expected),
            "{name}: {}",
            error(&wrapper)
        );
        let syntax = format!(".a{{}}{newline}.b{{}}{newline}!x{{}}");
        assert_eq!(
            syntax_location(&syntax),
            Some((3, 1)),
            "{name}: {}",
            error(&syntax)
        );
    }
}

/// A syntax failure points at the authored character, also right after a
/// renamed name or a removed wrapper, and after characters that UTF-16 or
/// UTF-8 encode with more than one unit.
#[test]
fn syntax_failures_point_at_the_authored_character() {
    for (source, column) in [
        (".a!{color:red}", 3),
        (".x :global(.a)!{}", 15),
        (".a{content:\"é\"} !{}", 17),
        (".a{content:\"😀\"} !{}", 17),
    ] {
        assert_eq!(
            syntax_location(source),
            Some((1, column)),
            "{source}: {}",
            error(source)
        );
    }
}

/// The token check points at the first authored token that scoping would
/// change or drop, with CSS line breaks and character columns, or at the end
/// of the stylesheet when scoping only adds tokens there.
#[test]
fn token_check_failures_point_at_the_first_changed_token() {
    let message = |line: usize, column: usize| {
        format!(
            "[mokly-css/build-invalid] CSS Modules scoping would change more than local names in {PATH}:{line}:{column}; move this CSS to a plain stylesheet"
        )
    };
    for (name, newline) in [("LF", "\n"), ("CR", "\r"), ("CRLF", "\r\n"), ("FF", "\x0C")] {
        let source = format!("a{{}}{newline}.é{{x:y}}");
        let output = format!("a{{}}{newline}.é{{x:z}}");
        let failure = module_integrity::check(PATH, &source, &output).unwrap_err();
        assert_eq!(failure.to_string(), message(2, 6), "{name}");
    }
    for (source, output, column) in [
        ("a{}", "b{}", 1),
        ("a{}", "a{}b", 4),
        ("a b", "a b b", 4),
        ("a{}b", "a{}", 4),
        ("a{}", "a b{}", 2),
        ("a:b{}", "a b{}", 2),
        ("a{}", "a{b}", 3),
        ("a{x:y;}", "a{x:y}", 6),
        ("a{b:f(x)}", "a{b:f(x y)}", 8),
    ] {
        let failure = module_integrity::check(PATH, source, output).unwrap_err();
        assert_eq!(failure.to_string(), message(1, column), "{source} {output}");
    }
    assert_eq!(error(".a :global(.b)c{color:red}"), message(1, 13));
}

/// Every diagnostic counts columns in characters, `@value` included.
#[test]
fn value_rules_count_columns_in_characters() {
    let expected = format!("@value is unsupported in {PATH}:1:6;");
    assert!(
        error("/*😀*/@value x: 1;").contains(&expected),
        "{}",
        error("/*😀*/@value x: 1;")
    );
}

/// The renamer and the token check read every statement through one
/// classification, so no statement form, with or without a block and at any
/// nesting level, fails the token check.
#[test]
fn no_statement_form_fails_the_token_check() {
    let statements = [
        "color:red",
        "--x:{a:b}",
        ".a",
        "a",
        "a:hover",
        "@keyframes x",
        "@scope (.a)",
        "@apply x",
        ":export",
        ":global(.a)",
        "*zoom:1",
        "",
        "composes:b",
        "animation:spin 1s",
        ".b :global(.a",
        "@keyframes :local(k",
    ];
    let levels = [
        ("", ""),
        ("@media all{", "}"),
        (".p{", "}"),
        ("@font-face{", "}"),
    ];
    for statement in statements {
        for block in ["", ";", "{}", "{color:red}"] {
            for (open, close) in levels {
                let source = format!(".b{{}}{open}{statement}{block}{close}");
                if let Err(error) = scope(PATH, &source) {
                    let message = error.to_string();
                    assert!(
                        !message.contains("would change more than local names"),
                        "{source:?}: {message}"
                    );
                }
            }
        }
    }
}
