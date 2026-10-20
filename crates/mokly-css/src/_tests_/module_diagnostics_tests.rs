//! CSS Modules failures come from the check that owns them, at the authored
//! line and column.

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
