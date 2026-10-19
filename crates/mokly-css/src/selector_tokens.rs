//! The selector token arena retains cssparser 0.38 lexical and nesting semantics.

use cssparser_next::{Parser, Token};

use crate::token_tree::{Lexeme, Tokens};

/// cssparser 0.38's existing default allowance for nested-block callbacks.
pub(crate) const NESTED_BLOCK_LIMIT: usize = 75;

pub(crate) fn tokenize(source: &str) -> Tokens<'_, Token<'_>> {
    Tokens::read(source, lex)
}

fn lex(source: &str) -> Option<Lexeme<Token<'_>>> {
    let mut parser = Parser::new(source);
    let token = parser
        .next_including_whitespace_and_comments()
        .ok()?
        .clone();
    Some(Lexeme {
        bytes: parser.position().byte_index(),
        trivia: matches!(token, Token::WhiteSpace(_) | Token::Comment(_)),
        open: match token {
            Token::Function(_) | Token::ParenthesisBlock => Some(')'),
            Token::CurlyBracketBlock => Some('}'),
            Token::SquareBracketBlock => Some(']'),
            _ => None,
        },
        close: match token {
            Token::CloseParenthesis => Some(')'),
            Token::CloseCurlyBracket => Some('}'),
            Token::CloseSquareBracket => Some(']'),
            _ => None,
        },
        token,
    })
}
