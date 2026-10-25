//! Shared statement grammar helpers for the CSS token scanners.

use std::ops::Range;

use cssparser::Token;

use crate::token_sections::{Grammar, Statement};
use crate::token_tree::Tokens;

/// Classify a statement when cssparser cannot return a parser result.
pub(crate) fn classify(
    tokens: &Tokens<'_>,
    mut prelude: Range<usize>,
    grammar: Grammar,
    block: bool,
) -> Statement {
    let mut significant = || {
        tokens
            .next_significant(&mut prelude)
            .map(|index| &tokens.nodes[index].token)
    };
    let (first, second) = (significant(), significant());
    let at_rule = match first {
        Some(Token::AtKeyword(name)) => Some(name.to_ascii_lowercase()),
        _ => None,
    };
    let declarations = matches!(grammar, Grammar::Style | Grammar::Declarations);
    let text = match grammar {
        Grammar::Declarations => true,
        Grammar::Style => at_rule.as_deref().is_some_and(unknown_keyframes),
        Grammar::Stylesheet | Grammar::Rules | Grammar::Lenient => false,
    };
    match (first, second) {
        (Some(Token::Ident(name)), Some(Token::Colon)) if declarations && !block => {
            Statement::Declaration(name.to_ascii_lowercase())
        }
        _ if text && !block => Statement::Text(at_rule),
        _ => at_rule.map_or(Statement::Rule, Statement::AtRule),
    }
}

/// Keep scanner text rules while taking starts and kinds from cssparser.
pub(crate) fn normalize(statement: Statement, grammar: Grammar, block: bool) -> Statement {
    if block {
        return statement;
    }
    match (grammar, statement) {
        (Grammar::Declarations, statement @ Statement::Declaration(_)) => statement,
        (Grammar::Declarations, Statement::AtRule(name)) => Statement::Text(Some(name)),
        (Grammar::Declarations, _) => Statement::Text(None),
        (Grammar::Style, Statement::AtRule(name)) if unknown_keyframes(&name) => {
            Statement::Text(Some(name))
        }
        (_, statement) => statement,
    }
}

/// Return the grammar of the block that a statement opens.
pub(crate) fn nested(grammar: Grammar, statement: &Statement) -> Grammar {
    match (grammar, statement) {
        (Grammar::Stylesheet | Grammar::Rules, Statement::AtRule(name)) if rule_list(name) => {
            Grammar::Rules
        }
        (Grammar::Stylesheet | Grammar::Rules | Grammar::Style, Statement::AtRule(name))
            if rule_list(name) || name == "-moz-document" =>
        {
            Grammar::Style
        }
        (Grammar::Stylesheet | Grammar::Rules | Grammar::Style, Statement::Rule) => Grammar::Style,
        (Grammar::Stylesheet | Grammar::Rules | Grammar::Lenient, Statement::AtRule(name))
            if grouping(name) =>
        {
            Grammar::Lenient
        }
        _ => Grammar::Declarations,
    }
}

fn rule_list(name: &str) -> bool {
    matches!(
        name,
        "media" | "supports" | "container" | "layer" | "scope" | "starting-style"
    )
}

fn grouping(name: &str) -> bool {
    name.ends_with("keyframes")
        || matches!(
            name,
            "media" | "supports" | "container" | "layer" | "document" | "scope" | "starting-style"
        )
}

fn unknown_keyframes(name: &str) -> bool {
    name.ends_with("keyframes")
        && !matches!(
            name,
            "keyframes" | "-webkit-keyframes" | "-moz-keyframes" | "-o-keyframes" | "-ms-keyframes"
        )
}

/// True when the statement starts with a dashed ident and a colon.
pub(crate) fn custom_property(tokens: &Tokens<'_>, mut range: Range<usize>) -> bool {
    let mut significant = || {
        tokens
            .next_significant(&mut range)
            .map(|index| &tokens.nodes[index].token)
    };
    matches!(significant(), Some(Token::Ident(name)) if name.starts_with("--"))
        && matches!(significant(), Some(Token::Colon))
}
