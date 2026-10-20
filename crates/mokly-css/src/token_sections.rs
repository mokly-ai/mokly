//! Statement boundaries at one block level: a prelude, then `{}` or `;`.

use std::ops::Range;

use cssparser::Token;

use crate::token_tree::Tokens;

/// How the statements of one block end. Style rules and the blocks nested in
/// them follow lightningcss. Declaration-only at-rules such as `@font-face`
/// end a non-custom statement at its first `{}` block, as postcss does.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Grammar {
    /// The stylesheet, and grouping at-rule blocks outside declaration blocks:
    /// a statement ends at its `{}` block or at `;`.
    Rules,
    /// Style rules, declaration at-rules, and every block nested in them: a
    /// custom property runs through its `{}` blocks to the next `;`. Every
    /// other statement ends as in [`Grammar::Rules`].
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

    /// The lowercase name of the at-rule that the statement starts with.
    pub(crate) fn at_rule(&self, tokens: &Tokens<'_>) -> Option<String> {
        at_rule(tokens, self.prelude.clone())
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
    let custom = grammar == Grammar::Declarations && custom_property(tokens, range.clone());
    while let Some(index) = tokens.next(range) {
        let node = &tokens.nodes[index];
        let body = !custom && matches!(node.token, Token::CurlyBracketBlock);
        let semicolon = matches!(node.token, Token::Semicolon);
        if body || semicolon {
            let prelude = begin..index;
            let block = body.then(|| Block {
                range: tokens.children(index),
                grammar: nested(grammar, at_rule(tokens, prelude.clone()).as_deref()),
            });
            return Some(Section {
                prelude,
                start,
                end: node.start,
                block,
                semicolon,
            });
        }
    }
    Some(Section {
        prelude: begin..range.end,
        start,
        end: tokens.offset(range.end),
        block: None,
        semicolon: false,
    })
}

/// The grammar of a block that a statement opens. Inside declarations, every
/// nested block declares. In rules, only a grouping at-rule holds rules.
fn nested(grammar: Grammar, at_rule: Option<&str>) -> Grammar {
    if grammar == Grammar::Rules && at_rule.is_some_and(grouping) {
        Grammar::Rules
    } else {
        Grammar::Declarations
    }
}

/// At-rules whose blocks hold rules: keyframes, conditional, layer, document,
/// scope, and starting-style rules.
fn grouping(name: &str) -> bool {
    name.ends_with("keyframes")
        || matches!(
            name,
            "media" | "supports" | "container" | "layer" | "document" | "scope" | "starting-style"
        )
}

/// The lowercase at-keyword name when the range starts with an at-rule.
fn at_rule(tokens: &Tokens<'_>, mut range: Range<usize>) -> Option<String> {
    match tokens
        .next_significant(&mut range)
        .map(|index| &tokens.nodes[index].token)
    {
        Some(Token::AtKeyword(name)) => Some(name.to_ascii_lowercase()),
        _ => None,
    }
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
