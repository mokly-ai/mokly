//! Differential coverage for the legacy and parser-backed section walks.

use crate::token_grammar;
use crate::token_sections::{self, Grammar, Statement};
use crate::token_tree::Tokens;

#[path = "token_differential_fixtures_1.rs"]
mod fixtures_1;
#[path = "token_differential_fixtures_2.rs"]
mod fixtures_2;
#[path = "token_differential_fixtures_3.rs"]
mod fixtures_3;

#[derive(Debug, PartialEq)]
struct Observed {
    start: usize,
    statement: Statement,
    block: Option<Grammar>,
}

type LegacySection = (usize, Option<(std::ops::Range<usize>, Grammar)>, Statement);

fn scan_new(source: &str) -> Vec<Observed> {
    let tokens = Tokens::new(source);
    let mut result = Vec::new();
    walk_new(&tokens, tokens.root(), Grammar::Stylesheet, &mut result);
    result
}

fn walk_new(
    tokens: &Tokens<'_>,
    mut range: std::ops::Range<usize>,
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
    mut range: std::ops::Range<usize>,
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
    range: &mut std::ops::Range<usize>,
    grammar: Grammar,
) -> Option<LegacySection> {
    tokens.next_significant(&mut range.clone())?;
    let begin = range.start;
    let start = tokens.offset(begin);
    let custom = matches!(grammar, Grammar::Style | Grammar::Declarations)
        && token_grammar::custom_property(tokens, range.clone());
    while let Some(index) = tokens.next(range) {
        let node = &tokens.nodes[index];
        let body = !custom && matches!(node.token, cssparser::Token::CurlyBracketBlock);
        let semicolon = matches!(node.token, cssparser::Token::Semicolon);
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

fn html_comment(tokens: &Tokens<'_>, mut range: std::ops::Range<usize>) -> bool {
    tokens.next_significant(&mut range).is_some_and(|index| {
        matches!(
            tokens.nodes[index].token,
            cssparser::Token::CDO | cssparser::Token::CDC
        )
    })
}

fn generated_sources() -> Vec<String> {
    let prefixes = ["", "<!--", "-->", " /* note */ <!--", "\n-->\n"];
    let statements = [
        "@value x: red;",
        "@keyframes spin{to{opacity:0}}",
        "@media all{.a{color:red}}",
        ".a{color:red}",
        "@font-face{src:url(font.woff2)}",
    ];
    prefixes
        .iter()
        .flat_map(|prefix| {
            statements
                .iter()
                .map(move |statement| format!("{prefix}{statement}.b{{animation:spin 1s}}"))
        })
        .collect()
}

/// Compare the legacy and parser-backed section walks across repository CSS
/// and generated edge cases. Every difference must have a parser explanation.
#[test]
fn parser_differential_covers_repository_stylesheets_and_generated_cases() {
    let mut sources = fixtures_1::REPOSITORY_STYLESHEETS
        .iter()
        .chain(fixtures_2::REPOSITORY_STYLESHEETS)
        .chain(fixtures_3::REPOSITORY_STYLESHEETS)
        .map(|(name, source)| ((*name).to_owned(), (*source).to_owned()))
        .collect::<Vec<_>>();
    sources.extend(
        generated_sources()
            .into_iter()
            .enumerate()
            .map(|(index, source)| (format!("generated-{index}"), source)),
    );
    assert!(!sources.is_empty());

    for (name, source) in sources {
        let old = scan_old(&source);
        let new = scan_new(&source);
        for (index, (left, right)) in old.iter().zip(new.iter()).enumerate() {
            if left == right {
                continue;
            }
            let start = right.start.min(source.len());
            let sample = &source[start..source.len().min(start + 32)];
            let reason = if left.statement == right.statement
                && left.block == right.block
                && left.start != right.start
            {
                "cssparser skips leading whitespace and comments before the statement"
            } else if source[..start].contains("<!--") || source[..start].contains("-->") {
                "cssparser skips an HTML comment token before the statement"
            } else {
                "no approved parser difference"
            };
            assert_ne!(
                reason, "no approved parser difference",
                "unexplained scanner difference in {name} at {index}: old={left:?}, new={right:?}, sample={sample:?}"
            );
        }
        assert_eq!(
            old.len(),
            new.len(),
            "scanner section count differs in {name}"
        );
    }
}
