//! Statement boundaries at one block level: a prelude, then `{}` or `;`.

use std::ops::Range;

use cssparser::Token;

use crate::token_tree::Tokens;

/// How the statements of one block end and read. The grammar of a block
/// depends on its statement and on the grammar of the block around it, as
/// `nested()` picks it. lightningcss parses rules strictly in the stylesheet,
/// in style rules, and in the grouping rules among them: a rule without a
/// block there fails the stylesheet. In a keyframes or `@document` block, and
/// in an at-rule block that holds declarations or text, lightningcss keeps,
/// drops, or rejects text instead.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Grammar {
    /// A rule list: the stylesheet, and the block of a conditional, layer,
    /// scope, or starting-style rule in a rule list. A statement ends at its
    /// `{}` block or at `;`, and it is a rule or an at-rule.
    Rules,
    /// A style block: the block of a style rule or an `@-moz-document` rule
    /// in a rule list or a style block, and the block of a conditional,
    /// layer, scope, or starting-style rule in a style block. A custom
    /// property runs through its `{}` blocks to the next `;`, and a statement
    /// without a block that starts with an identifier and a colon is a
    /// declaration. Every other statement is a rule or an at-rule, except the
    /// text that [`Statement::Text`] names.
    Style,
    /// A lenient rule list: the block of a keyframes or `@document` rule in a
    /// rule list, and the block of a keyframes, conditional, layer,
    /// `@document`, scope, or starting-style rule in a lenient rule list. A
    /// keyframes rule here is any at-rule whose name ends with `keyframes`.
    /// lightningcss does not parse these blocks as rules. Statements end and
    /// read as in [`Grammar::Rules`], and every other block they open is a
    /// [`Grammar::Declarations`] block, also an `@-moz-document` block.
    Lenient,
    /// Any other block, such as `@font-face`, a keyframe, an unknown at-rule,
    /// or a rule's block in a [`Grammar::Lenient`] block, and every block in
    /// one: statements end as in [`Grammar::Style`], and a statement without
    /// a block is a declaration or text.
    Declarations,
}

/// The `{}` block that ends a statement, and the grammar of its statements.
#[derive(Clone, Debug)]
pub(crate) struct Block {
    /// The child tokens of the block.
    pub(crate) range: Range<usize>,
    /// The grammar of the statements inside the block.
    pub(crate) grammar: Grammar,
}

/// What a statement is, read as lightningcss reads the block that holds it.
/// Every scanner reads a statement through this one classification.
#[derive(Clone, Debug, PartialEq)]
pub(crate) enum Statement {
    /// A statement that is not text and starts with an at-keyword, by its
    /// lowercase name.
    AtRule(String),
    /// A statement without a block that starts with an identifier and a
    /// colon, by its lowercase property name, in a style or declarations
    /// block. A custom property is one, because its value keeps its `{}`
    /// blocks.
    Declaration(String),
    /// Any other statement that is not text: a qualified rule, whose prelude
    /// is a selector. A rule that is still open at the end of input has no
    /// block, but it is still a rule.
    Rule,
    /// A statement without a block that lightningcss keeps or drops as text,
    /// so scanners keep it as authored: any statement that is not a
    /// declaration in a declarations block, and an at-rule under a keyframes
    /// name that lightningcss does not know, such as `@-khtml-keyframes`, in
    /// a style block. Holds the lowercase at-keyword that starts it, if any.
    Text(Option<String>),
}

/// One rule or declaration at a block's own level.
pub(crate) struct Section {
    /// Tokens before the `{` or `;`, including leading whitespace.
    pub(crate) prelude: Range<usize>,
    /// Byte offset of the first prelude token, which can be whitespace.
    pub(crate) start: usize,
    /// Byte offset of the `{` or `;`, or the end of the enclosing block.
    pub(crate) end: usize,
    /// The `{}` block that ends the section, with the grammar of its statements.
    pub(crate) block: Option<Block>,
    /// True when a `;` ends the section.
    pub(crate) semicolon: bool,
    /// What the statement is.
    pub(crate) statement: Statement,
}

impl Section {
    /// The index of the first prelude token that is not whitespace or a comment.
    pub(crate) fn first(&self, tokens: &Tokens<'_>) -> Option<usize> {
        tokens.next_significant(&mut self.prelude.clone())
    }

    /// The byte offset of the first significant token, where diagnostics point.
    pub(crate) fn lead(&self, tokens: &Tokens<'_>) -> usize {
        self.first(tokens)
            .map_or(self.start, |index| tokens.nodes[index].start)
    }

    /// True when the statement starts with a dashed ident and a colon.
    pub(crate) fn custom_property(&self, tokens: &Tokens<'_>) -> bool {
        custom_property(tokens, self.prelude.clone())
    }

    /// The source text from the section start to its `{`, `;`, or block end.
    pub(crate) fn text<'a>(&self, tokens: &Tokens<'a>) -> &'a str {
        &tokens.source[self.start..self.end]
    }
}

/// Take the next section of a block whose statements use `grammar`; `None`
/// when only trivia remains.
pub(crate) fn next(
    tokens: &Tokens<'_>,
    range: &mut Range<usize>,
    grammar: Grammar,
) -> Option<Section> {
    tokens.next_significant(&mut range.clone())?;
    let begin = range.start;
    let start = tokens.offset(begin);
    let custom = matches!(grammar, Grammar::Style | Grammar::Declarations)
        && custom_property(tokens, range.clone());
    while let Some(index) = tokens.next(range) {
        let node = &tokens.nodes[index];
        let body = !custom && matches!(node.token, Token::CurlyBracketBlock);
        let semicolon = matches!(node.token, Token::Semicolon);
        if body || semicolon {
            let prelude = begin..index;
            let statement = classify(tokens, prelude.clone(), grammar, body);
            let block = body.then(|| Block {
                range: tokens.children(index),
                grammar: nested(grammar, &statement, html_comment(tokens, prelude.clone())),
            });
            return Some(Section {
                prelude,
                start,
                end: node.start,
                block,
                semicolon,
                statement,
            });
        }
    }
    let prelude = begin..range.end;
    Some(Section {
        statement: classify(tokens, prelude.clone(), grammar, false),
        prelude,
        start,
        end: tokens.offset(range.end),
        block: None,
        semicolon: false,
    })
}

/// Classify a statement by its first tokens and its block, as lightningcss
/// reads the block that holds it.
fn classify(
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
        Grammar::Rules | Grammar::Lenient => false,
    };
    match (first, second) {
        (Some(Token::Ident(name)), Some(Token::Colon)) if declarations && !block => {
            Statement::Declaration(name.to_ascii_lowercase())
        }
        _ if text && !block => Statement::Text(at_rule),
        _ => at_rule.map_or(Statement::Rule, Statement::AtRule),
    }
}

/// True for an at-rule name that ends with `keyframes` but that lightningcss
/// does not parse. In a style rule, lightningcss keeps such an at-rule
/// without a block as text.
fn unknown_keyframes(name: &str) -> bool {
    name.ends_with("keyframes")
        && !matches!(
            name,
            "keyframes" | "-webkit-keyframes" | "-moz-keyframes" | "-o-keyframes" | "-ms-keyframes"
        )
}

/// The grammar of the block that a statement opens. An `@-moz-document`
/// block reads as a style rule's block, so a keyframes block in it holds
/// declarations. cssparser skips `<!--` and `-->` before a statement in the
/// stylesheet, so a rule that starts with one can be an at-rule there, and
/// its block holds declarations.
fn nested(grammar: Grammar, statement: &Statement, html_comment: bool) -> Grammar {
    match (grammar, statement) {
        (Grammar::Rules, Statement::AtRule(name)) if rule_list(name) => Grammar::Rules,
        (Grammar::Rules | Grammar::Style, Statement::AtRule(name))
            if rule_list(name) || name == "-moz-document" =>
        {
            Grammar::Style
        }
        (Grammar::Rules | Grammar::Style, Statement::Rule) if !html_comment => Grammar::Style,
        (Grammar::Rules | Grammar::Lenient, Statement::AtRule(name)) if grouping(name) => {
            Grammar::Lenient
        }
        _ => Grammar::Declarations,
    }
}

/// At-rules whose blocks lightningcss parses as rules: conditional, layer,
/// scope, and starting-style rules.
fn rule_list(name: &str) -> bool {
    matches!(
        name,
        "media" | "supports" | "container" | "layer" | "scope" | "starting-style"
    )
}

/// At-rules whose blocks the scanners read as rules: keyframes, conditional,
/// layer, document, scope, and starting-style rules.
fn grouping(name: &str) -> bool {
    name.ends_with("keyframes")
        || matches!(
            name,
            "media" | "supports" | "container" | "layer" | "document" | "scope" | "starting-style"
        )
}

/// True when the statement starts with `<!--` or `-->`.
fn html_comment(tokens: &Tokens<'_>, mut range: Range<usize>) -> bool {
    tokens
        .next_significant(&mut range)
        .is_some_and(|index| matches!(tokens.nodes[index].token, Token::CDO | Token::CDC))
}

/// True when the statement starts with a dashed ident and a colon.
fn custom_property(tokens: &Tokens<'_>, mut range: Range<usize>) -> bool {
    let mut significant = || {
        tokens
            .next_significant(&mut range)
            .map(|index| &tokens.nodes[index].token)
    };
    matches!(significant(), Some(Token::Ident(name)) if name.starts_with("--"))
        && matches!(significant(), Some(Token::Colon))
}

#[cfg(test)]
#[path = "_tests_/token_sections_tests.rs"]
mod token_sections_tests;
