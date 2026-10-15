//! Reject authored CSS Modules at-rules before rename-only scoping.

use std::result;

use cssparser::{Delimiter, ParseError, Parser, ParserInput, Token};

use crate::error::{CssError, Result, TransformFailure};

pub(crate) fn check(path: &str, source: &str) -> Result<()> {
    let mut input = ParserInput::new(source);
    scan(path, &mut Parser::new(&mut input))
}

fn scan(path: &str, parser: &mut Parser<'_, '_>) -> Result<()> {
    while !parser.is_exhausted() {
        let location = parser.current_source_location();
        let mut first = None;
        let _: result::Result<_, ParseError<'_, ()>> = parser.parse_until_before(
            Delimiter::CurlyBracketBlock | Delimiter::Semicolon,
            |prelude| {
                first = prelude.next().ok().cloned();
                while prelude.next().is_ok() {}
                Ok(())
            },
        );
        if matches!(&first, Some(Token::AtKeyword(name)) if name.eq_ignore_ascii_case("value")) {
            return Err(CssError::Transform {
                kind: TransformFailure::Modules,
                message: format!(
                    "CSS Modules @value is unsupported in {path}:{}:{}; use a CSS custom property or JavaScript constant",
                    location.line + 1,
                    location.column
                ),
            });
        }
        if matches!(parser.next(), Ok(Token::CurlyBracketBlock)) {
            if matches!(&first, Some(Token::Ident(name)) if name.starts_with("--")) {
                continue;
            }
            let mut result = Ok(());
            let _: result::Result<_, ParseError<'_, ()>> = parser.parse_nested_block(|nested| {
                result = scan(path, nested);
                Ok(())
            });
            result?;
        }
    }
    Ok(())
}
