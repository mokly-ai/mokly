//! The probe reads one stylesheet statement with cssparser's own parser.

use crate::token_sections::{Grammar, Statement};
use crate::token_statement::parse;

/// The start and kind that the probe reads for a stylesheet statement.
fn read(source: &str, first: bool) -> Option<(usize, Statement)> {
    parse(source, Grammar::Stylesheet, first, false).map(|parsed| (parsed.start, parsed.statement))
}

/// cssparser skips a `@charset` only as the first rule of a stylesheet, so a
/// later `@charset` reads as an ordinary at-rule.
#[test]
fn only_the_first_stylesheet_statement_skips_a_charset() {
    assert_eq!(read("@charset \"x\"", true), None);
    assert_eq!(
        read("@charset \"x\"", false),
        Some((0, Statement::AtRule("charset".into())))
    );
}

/// A later stylesheet statement is read after the rule `a{}`. When cssparser
/// reads no prelude of that statement, the record of the rule before it is
/// never the result, so the section reader classifies the statement by its
/// tokens.
#[test]
fn a_later_statement_without_a_parsed_prelude_reads_no_statement() {
    assert_eq!(read("--x:1", false), None);
    assert_eq!(read("<!--", false), None);
}

/// cssparser drops a later rule without a block, but it reads the rule's
/// prelude first, so the rule keeps the start of that prelude.
#[test]
fn a_later_rule_without_a_block_keeps_its_start() {
    assert_eq!(read(" <!-- .b", false), Some((6, Statement::Rule)));
}
