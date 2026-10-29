//! Statement boundaries at one block level: a prelude, then `{}` or `;`.

use std::ops::Range;

use cssparser::Token;

use crate::token_grammar::{classify, custom_property, nested, normalize};
use crate::token_statement;
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
    /// The top-level stylesheet, which skips HTML comment tokens before each
    /// statement as cssparser does.
    Stylesheet,
    /// A rule list block of a conditional, layer, scope, or starting-style
    /// rule. A statement ends at its `{}` block or at `;`, and it is a rule or
    /// an at-rule.
    Rules,
    /// A style block: the block of a style rule or an `@-moz-document` rule
    /// in a rule list or a style block, and the block of a conditional,
    /// layer, scope, starting-style, or `@nest` rule in a style block. A custom
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

/// What a statement is, read as `lightningcss` reads the block that holds it.
/// Outside a descriptor block, each statement that `lightningcss` keeps reads
/// with the start and kind that `lightningcss` gives it. An `@-moz-document`
/// block outside a style rule is an exception: it reads as a style block here,
/// but `lightningcss` parses it as a rule list, as it parses `@media`.
///
/// In a descriptor block such as `@font-face`, a statement that is not a
/// custom property ends at its first `{}` block, as postcss reads it. See
/// [`Grammar::Declarations`]. In `@font-face{c:d{x}e;}`, `lightningcss` keeps
/// the descriptor `c: d{x}e`, but this reader reads a rule `c:d` with a block,
/// then the text `e`.
///
/// Text that `lightningcss` drops or rejects can read as other statements. For
/// example, a rule-list statement that a `;` ends can read differently.
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
    /// Tokens from the statement start to the `{`, the `;`, or the end of the
    /// enclosing block.
    pub(crate) prelude: Range<usize>,
    /// Byte offset of the statement start: where cssparser starts the
    /// statement, or the first token of the section when cssparser reads no
    /// statement there.
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
    /// The byte offset of the statement start, where diagnostics point.
    pub(crate) fn lead(&self) -> usize {
        self.start
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
    let initial = tokens.offset(begin);
    let custom = matches!(grammar, Grammar::Style | Grammar::Declarations)
        && custom_property(tokens, range.clone());
    while let Some(index) = tokens.next(range) {
        let node = &tokens.nodes[index];
        let body = !custom && matches!(node.token, Token::CurlyBracketBlock);
        let semicolon = matches!(node.token, Token::Semicolon);
        if body || semicolon {
            let parsed = token_statement::parse(
                &tokens.source[initial..node.start],
                grammar,
                begin == 0,
                body,
            );
            let start = parsed
                .as_ref()
                .map_or(initial, |parsed| initial + parsed.start);
            let prelude_begin = (begin..index)
                .find(|&token| tokens.nodes[token].start >= start)
                .unwrap_or(index);
            let prelude = prelude_begin..index;
            let statement = parsed.map_or_else(
                || classify(tokens, prelude.clone(), grammar, body),
                |parsed| normalize(parsed.statement, grammar, body),
            );
            let block = body.then(|| Block {
                range: tokens.children(index),
                grammar: nested(grammar, &statement),
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
    let parsed = token_statement::parse(
        &tokens.source[initial..tokens.offset(range.end)],
        grammar,
        begin == 0,
        false,
    );
    let start = parsed
        .as_ref()
        .map_or(initial, |parsed| initial + parsed.start);
    let prelude_begin = (begin..range.end)
        .find(|&token| tokens.nodes[token].start >= start)
        .unwrap_or(range.end);
    let prelude = prelude_begin..range.end;
    let statement = parsed.map_or_else(
        || classify(tokens, prelude.clone(), grammar, false),
        |parsed| normalize(parsed.statement, grammar, false),
    );
    Some(Section {
        statement,
        prelude,
        start,
        end: tokens.offset(range.end),
        block: None,
        semicolon: false,
    })
}

#[cfg(test)]
#[path = "_tests_/token_sections_tests.rs"]
mod token_sections_tests;
