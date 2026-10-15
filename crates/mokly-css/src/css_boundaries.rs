//! Ignore CSS's top-level HTML boundary tokens without touching nested or quoted text.

use std::result;

use cssparser::{ParseError, Parser, ParserInput, Token};

pub(crate) fn strip(source: &str) -> String {
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    let mut edits = Vec::new();
    while !parser.is_exhausted() {
        let start = parser.position().byte_index();
        let Ok(token) = parser.next_including_whitespace_and_comments().cloned() else {
            break;
        };
        match token {
            Token::CDO | Token::CDC => edits.push((start, parser.position().byte_index())),
            Token::Function(_)
            | Token::CurlyBracketBlock
            | Token::SquareBracketBlock
            | Token::ParenthesisBlock => {
                let _: result::Result<_, ParseError<'_, ()>> =
                    parser.parse_nested_block(|nested| {
                        consume(nested);
                        Ok(())
                    });
            }
            _ => {}
        }
    }
    let mut output = source.to_owned();
    for (start, end) in edits.into_iter().rev() {
        if output.get(start..end).is_some() {
            output.replace_range(start..end, "");
        }
    }
    output
}

fn consume(parser: &mut Parser<'_, '_>) {
    while let Ok(token) = parser.next_including_whitespace_and_comments().cloned() {
        if matches!(
            token,
            Token::Function(_)
                | Token::CurlyBracketBlock
                | Token::SquareBracketBlock
                | Token::ParenthesisBlock
        ) {
            let _: result::Result<_, ParseError<'_, ()>> = parser.parse_nested_block(|nested| {
                consume(nested);
                Ok(())
            });
        }
    }
}
