//! Independent token comparison admits only module names, scope wrappers, and compositions.

use std::result;

use cssparser::{Delimiter, ParseError, Parser, ParserInput, Token};
use mokly_model::material::digest;

use crate::error::{CssError, Result, TransformFailure};
use crate::rename::grouping;

pub(crate) fn check(path: &str, source: &str, output: &str) -> Result<()> {
    let prefix = format!("mokly_{}_", &digest(path.as_bytes())[..12]);
    if fingerprint(source, &prefix) == fingerprint(output, &prefix) {
        return Ok(());
    }
    Err(CssError::Transform {
        kind: TransformFailure::Modules,
        message: format!(
            "CSS Modules scoping would change more than local names in {path}:1:1; move this CSS to a plain stylesheet"
        ),
    })
}

fn fingerprint(source: &str, prefix: &str) -> Vec<String> {
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    let mut result = Vec::new();
    block(&mut parser, false, prefix, &mut result);
    result
}

fn block(parser: &mut Parser<'_, '_>, declarations: bool, prefix: &str, output: &mut Vec<String>) {
    while !parser.is_exhausted() {
        let mut prelude = String::new();
        let _: result::Result<_, ParseError<'_, ()>> = parser.parse_until_before(
            Delimiter::CurlyBracketBlock | Delimiter::Semicolon,
            |parser| {
                let start = parser.position();
                while parser.next().is_ok() {}
                prelude = parser.slice_from(start).into();
                Ok(())
            },
        );
        let delimiter = parser.next().cloned();
        let mut input = ParserInput::new(&prelude);
        let mut header = Parser::new(&mut input);
        let first = header.next().cloned();
        let at = match &first {
            Ok(Token::AtKeyword(name)) => Some(name.to_ascii_lowercase()),
            _ => None,
        };
        if matches!(delimiter, Ok(Token::CurlyBracketBlock)) {
            let names = at
                .as_deref()
                .is_none_or(|name| name.ends_with("keyframes") || name == "scope");
            tokens(
                &mut Parser::new(&mut ParserInput::new(&prelude)),
                names,
                prefix,
                output,
            );
            output.push("{".into());
            let nested_declarations = at.as_deref().is_none_or(|name| !grouping(name));
            let _: result::Result<_, ParseError<'_, ()>> = parser.parse_nested_block(|nested| {
                block(nested, nested_declarations, prefix, output);
                Ok(())
            });
            output.push("}".into());
        } else {
            let property = if declarations && header.expect_colon().is_ok() {
                match first {
                    Ok(Token::Ident(name)) => Some(name.to_ascii_lowercase()),
                    _ => None,
                }
            } else {
                None
            };
            if property.as_deref() == Some("composes") {
                continue;
            }
            let names = property.as_deref().is_some_and(|name| {
                matches!(
                    name,
                    "animation" | "animation-name" | "-webkit-animation" | "-webkit-animation-name"
                )
            });
            tokens(
                &mut Parser::new(&mut ParserInput::new(&prelude)),
                names,
                prefix,
                output,
            );
            if matches!(delimiter, Ok(Token::Semicolon)) {
                output.push(";".into());
            }
        }
    }
}

fn tokens(parser: &mut Parser<'_, '_>, names: bool, prefix: &str, output: &mut Vec<String>) {
    while !parser.is_exhausted() {
        let Ok(token) = parser.next_including_whitespace_and_comments().cloned() else {
            break;
        };
        match token {
            Token::WhiteSpace(_) => {}
            Token::Ident(value) => output.push(format!(
                "ident:{}",
                if names {
                    value.strip_prefix(prefix).unwrap_or(&value)
                } else {
                    &value
                }
            )),
            Token::IDHash(value) => output.push(format!(
                "id:{}",
                if names {
                    value.strip_prefix(prefix).unwrap_or(&value)
                } else {
                    &value
                }
            )),
            Token::QuotedString(value) => output.push(format!(
                "string:{}",
                if names {
                    value.strip_prefix(prefix).unwrap_or(&value)
                } else {
                    &value
                }
            )),
            Token::Colon if names => {
                let state = parser.state();
                match parser.next().cloned() {
                    Ok(Token::Ident(name)) if matches!(name.as_ref(), "local" | "global") => {}
                    Ok(Token::Function(name)) if matches!(name.as_ref(), "local" | "global") => {
                        let _: result::Result<_, ParseError<'_, ()>> =
                            parser.parse_nested_block(|nested| {
                                tokens(nested, names, prefix, output);
                                Ok(())
                            });
                    }
                    _ => {
                        parser.reset(&state);
                        output.push(":".into());
                    }
                }
            }
            Token::Function(_)
            | Token::ParenthesisBlock
            | Token::SquareBracketBlock
            | Token::CurlyBracketBlock => {
                output.push(format!("{token:?}"));
                let _: result::Result<_, ParseError<'_, ()>> =
                    parser.parse_nested_block(|nested| {
                        tokens(nested, names, prefix, output);
                        Ok(())
                    });
                output.push("end".into());
            }
            token => output.push(format!("{token:?}")),
        }
    }
}
