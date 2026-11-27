//! HTML comment tokens before a statement move only the starts after them.

use std::ops::Range;

use crate::token_sections::{self, Grammar, Statement};
use crate::token_tree::Tokens;

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

/// One statement that the section reader finds, at any block depth.
#[derive(Debug, PartialEq)]
struct Observed {
    /// The byte offset where the reader starts the statement.
    start: usize,
    /// The statement kind selected by the reader.
    statement: Statement,
    /// The grammar selected for the statement's block, if it has one.
    block: Option<Grammar>,
}

fn generated_sources() -> Vec<String> {
    STATEMENTS
        .iter()
        .map(|statement| format!("{statement}{SECOND}"))
        .collect()
}

/// Every statement of `source`, in reading order, read as a stylesheet.
fn scan(source: &str) -> Vec<Observed> {
    let tokens = Tokens::new(source);
    let mut result = Vec::new();
    walk(&tokens, tokens.root(), Grammar::Stylesheet, &mut result);
    result
}

fn walk(tokens: &Tokens<'_>, mut range: Range<usize>, grammar: Grammar, out: &mut Vec<Observed>) {
    while let Some(section) = token_sections::next(tokens, &mut range, grammar) {
        let block = section.block.as_ref().map(|block| block.grammar);
        let child = section.block.map(|block| block.range);
        out.push(Observed {
            start: section.start,
            statement: section.statement,
            block,
        });
        if let (Some(child), Some(grammar)) = (child, block) {
            walk(tokens, child, grammar, out);
        }
    }
}

/// An HTML comment prefix before the first or the second stylesheet statement
/// changes the walk only by moving each start at or after it by its length.
#[test]
fn html_comment_prefixes_only_move_the_starts_after_them() {
    for source in generated_sources() {
        let expected = scan(&source);
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
                assert_eq!(scan(&prefixed), moved, "{prefixed:?}");
            }
        }
    }
}
