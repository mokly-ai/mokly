//! Both statement readers for the differential tests: the token walk from
//! before user decision 111 C and the parser-backed section reader.

use std::ops::Range;

use cssparser::Token;

use crate::token_grammar;
use crate::token_sections::{self, Grammar, Statement};
use crate::token_tree::Tokens;

/// One observation from either statement reader.
#[derive(Debug, PartialEq)]
pub(crate) struct Observed {
    /// The byte offset where the reader starts the statement.
    pub(crate) start: usize,
    /// The statement kind selected by the reader.
    pub(crate) statement: Statement,
    /// The grammar selected for the statement's block, if it has one.
    pub(crate) block: Option<Grammar>,
}

type LegacySection = (usize, Option<(Range<usize>, Grammar)>, Statement);

/// Scan `source` with the parser-backed section reader.
pub(crate) fn scan_new(source: &str) -> Vec<Observed> {
    let tokens = Tokens::new(source);
    let mut result = Vec::new();
    walk_new(&tokens, tokens.root(), Grammar::Stylesheet, &mut result);
    result
}

fn walk_new(
    tokens: &Tokens<'_>,
    mut range: Range<usize>,
    grammar: Grammar,
    out: &mut Vec<Observed>,
) {
    while let Some(section) = token_sections::next(tokens, &mut range, grammar) {
        let block = section.block.as_ref().map(|block| block.grammar);
        let child = section.block.map(|block| block.range);
        out.push(Observed {
            start: section.start,
            statement: section.statement,
            block,
        });
        if let Some(child) = child {
            walk_new(tokens, child, out.last().unwrap().block.unwrap(), out);
        }
    }
}

fn scan_old(source: &str) -> Vec<Observed> {
    let tokens = Tokens::new(source);
    let mut result = Vec::new();
    walk_old(&tokens, tokens.root(), Grammar::Rules, &mut result);
    result
}

fn walk_old(
    tokens: &Tokens<'_>,
    mut range: Range<usize>,
    grammar: Grammar,
    out: &mut Vec<Observed>,
) {
    while let Some(section) = legacy_next(tokens, &mut range, grammar) {
        let block = section.1.as_ref().map(|block| block.1);
        let child = section.1.map(|block| block.0);
        out.push(Observed {
            start: section.0,
            statement: section.2,
            block,
        });
        if let Some(child) = child {
            walk_old(tokens, child, out.last().unwrap().block.unwrap(), out);
        }
    }
}

fn legacy_next(
    tokens: &Tokens<'_>,
    range: &mut Range<usize>,
    grammar: Grammar,
) -> Option<LegacySection> {
    tokens.next_significant(&mut range.clone())?;
    let begin = range.start;
    let start = tokens.offset(begin);
    let custom = matches!(grammar, Grammar::Style | Grammar::Declarations)
        && token_grammar::custom_property(tokens, range.clone());
    while let Some(index) = tokens.next(range) {
        let node = &tokens.nodes[index];
        let body = !custom && matches!(node.token, Token::CurlyBracketBlock);
        let semicolon = matches!(node.token, Token::Semicolon);
        if body || semicolon {
            let prelude = begin..index;
            let statement = token_grammar::classify(tokens, prelude.clone(), grammar, body);
            let block = body.then(|| {
                (
                    tokens.children(index),
                    legacy_nested(grammar, &statement, html_comment(tokens, prelude.clone())),
                )
            });
            return Some((start, block, statement));
        }
    }
    let prelude = begin..range.end;
    Some((
        start,
        None,
        token_grammar::classify(tokens, prelude, grammar, false),
    ))
}

fn legacy_nested(grammar: Grammar, statement: &Statement, html_comment: bool) -> Grammar {
    match (grammar, statement) {
        (Grammar::Rules, Statement::AtRule(name)) if legacy_rule_list(name) => Grammar::Rules,
        (Grammar::Rules | Grammar::Style, Statement::AtRule(name))
            if legacy_rule_list(name) || name == "-moz-document" =>
        {
            Grammar::Style
        }
        (Grammar::Rules | Grammar::Style, Statement::Rule) if !html_comment => Grammar::Style,
        (Grammar::Rules | Grammar::Lenient, Statement::AtRule(name)) if legacy_grouping(name) => {
            Grammar::Lenient
        }
        _ => Grammar::Declarations,
    }
}

fn legacy_rule_list(name: &str) -> bool {
    matches!(
        name,
        "media" | "supports" | "container" | "layer" | "scope" | "starting-style"
    )
}

fn legacy_grouping(name: &str) -> bool {
    name.ends_with("keyframes")
        || matches!(
            name,
            "media" | "supports" | "container" | "layer" | "document" | "scope" | "starting-style"
        )
}

fn html_comment(tokens: &Tokens<'_>, mut range: Range<usize>) -> bool {
    tokens
        .next_significant(&mut range)
        .is_some_and(|index| matches!(tokens.nodes[index].token, Token::CDO | Token::CDC))
}

/// Return true when `text` holds only whitespace and comments.
fn trivia(text: &str) -> bool {
    Tokens::new(text)
        .nodes
        .iter()
        .all(|node| matches!(node.token, Token::WhiteSpace(_) | Token::Comment(_)))
}

/// Compare both section readers for one stylesheet.
///
/// The readers agree when their observations match, or when a start differs
/// only because one reader moves over whitespace or comments. Return `None`
/// when they agree. Otherwise, return a message for the first unexplained
/// difference.
pub fn first_difference(source: &str) -> Option<String> {
    let old = scan_old(source);
    let new = scan_new(source);
    for (index, (left, right)) in old.iter().zip(new.iter()).enumerate() {
        if left == right {
            continue;
        }
        let start = right.start.min(source.len());
        let sample = source[start..].chars().take(32).collect::<String>();
        let skipped = &source[left.start.min(start)..left.start.max(start)];
        if left.statement != right.statement || left.block != right.block || !trivia(skipped) {
            return Some(format!(
                "unexplained scanner difference at {index}: old={left:?}, new={right:?}, sample={sample:?}"
            ));
        }
    }
    (old.len() != new.len()).then(|| {
        format!(
            "scanner section count differs: old {}, new {}",
            old.len(),
            new.len()
        )
    })
}
