//! Unit coverage for the generated inputs and HTML comment starts.

use crate::token_differential::{Observed, first_difference, scan_new};

/// The statements at the first block level of each generated stylesheet.
const STATEMENTS: [&str; 5] = [
    "@value x: red;",
    "@keyframes spin{to{opacity:0}}",
    "@media all{.a{color:red}}",
    ".a{color:red}",
    "@font-face{src:url(font.woff2)}",
];

/// The second statement of each generated stylesheet.
const SECOND: &str = ".b{animation:spin 1s}";

/// HTML comment tokens that cssparser skips before a stylesheet statement,
/// alone and with whitespace and comments around them.
const HTML_COMMENT_PREFIXES: [&str; 4] = ["<!--", "-->", " /* note */ <!--", "\n-->\n"];

fn generated_sources() -> Vec<String> {
    STATEMENTS
        .iter()
        .map(|statement| format!("{statement}{SECOND}"))
        .collect()
}

/// The parser-backed and legacy readers agree on every generated stylesheet.
#[test]
fn parser_differential_agrees_on_generated_stylesheets() {
    for (index, source) in generated_sources().into_iter().enumerate() {
        let name = format!("generated-{index}");
        let difference = first_difference(&source);
        assert!(difference.is_none(), "{name}: {difference:?}");
    }
}

/// An HTML comment prefix before the first or the second stylesheet statement
/// changes the walk only by moving each start at or after it by its length.
#[test]
fn html_comment_prefixes_only_move_the_starts_after_them() {
    for source in generated_sources() {
        let expected = scan_new(&source);
        for prefix in HTML_COMMENT_PREFIXES {
            for at in [0, source.len() - SECOND.len()] {
                let prefixed = format!("{}{prefix}{}", &source[..at], &source[at..]);
                let moved = expected
                    .iter()
                    .map(|observed| Observed {
                        start: observed.start
                            + if observed.start >= at {
                                prefix.len()
                            } else {
                                0
                            },
                        statement: observed.statement.clone(),
                        block: observed.block,
                    })
                    .collect::<Vec<_>>();
                assert_eq!(scan_new(&prefixed), moved, "{prefixed:?}");
            }
        }
    }
}
