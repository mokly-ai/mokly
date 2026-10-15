//! Local and global selector edits retain authored token spelling elsewhere.

use std::result;

use cssparser::{ParseError, Parser, Token};

use crate::error;
use crate::error::Result;
use crate::rename::Renamer;

impl Renamer<'_> {
    pub(crate) fn selector(
        &mut self,
        parser: &mut Parser<'_, '_>,
        default_local: bool,
    ) -> Result<Option<String>> {
        let mut local = default_local;
        let mut atoms = Vec::new();
        while !parser.is_exhausted() {
            let start = parser.position().byte_index();
            let Ok(token) = parser.next_including_whitespace_and_comments().cloned() else {
                break;
            };
            let end = parser.position().byte_index();
            match token {
                Token::WhiteSpace(_) | Token::Comment(_) => {}
                Token::Delim('.') => {
                    let state = parser.state();
                    let name_start = parser.position().byte_index();
                    if let Ok(Token::Ident(name)) = parser.next().cloned() {
                        if local {
                            self.identifier(
                                &name,
                                name_start,
                                parser.position().byte_index(),
                                false,
                            );
                            self.defined.insert(name.to_string());
                            atoms.push(Some(name.to_string()));
                        } else {
                            atoms.push(None);
                        }
                    } else {
                        parser.reset(&state);
                        atoms.push(None);
                    }
                }
                Token::IDHash(name) => {
                    if local {
                        self.identifier(&name, start, end, true);
                    }
                    atoms.push(None);
                }
                Token::Comma => {
                    local = default_local;
                    atoms.push(None);
                }
                Token::Colon => {
                    let state = parser.state();
                    match parser.next().cloned() {
                        Ok(Token::Function(name)) if name == "global" || name == "local" => {
                            let function_end = parser.position().byte_index();
                            let mut result = Ok(None);
                            let mut nonempty = false;
                            let _: result::Result<_, ParseError<'_, ()>> = parser
                                .parse_nested_block(|nested| {
                                    nonempty = !nested.is_exhausted();
                                    result = self.selector(nested, name == "local");
                                    Ok(())
                                });
                            if !nonempty {
                                return Err(self.error(
                                    start,
                                    &format!("CSS Modules :{name}() has no selector"),
                                    "add a selector inside it or remove it",
                                ));
                            }
                            let own = result?;
                            atoms.push(own);
                            self.edits.push((start, function_end, String::new()));
                            self.edits.push((
                                parser.position().byte_index() - 1,
                                parser.position().byte_index(),
                                String::new(),
                            ));
                        }
                        Ok(Token::Ident(name)) if name == "global" || name == "local" => {
                            local = name == "local";
                            self.edits
                                .push((start, parser.position().byte_index(), String::new()));
                        }
                        Ok(Token::Function(name)) if name == "import" => {
                            return Err(self.icss(start, ":import"));
                        }
                        Ok(Token::Ident(name)) if name == "export" => {
                            return Err(self.icss(start, ":export"));
                        }
                        _ => {
                            parser.reset(&state);
                            atoms.push(None);
                        }
                    }
                }
                Token::Function(_) | Token::ParenthesisBlock => {
                    let mut result = Ok(None);
                    let _: result::Result<_, ParseError<'_, ()>> =
                        parser.parse_nested_block(|nested| {
                            result = self.selector(nested, local);
                            Ok(())
                        });
                    result?;
                    atoms.push(None);
                }
                _ => atoms.push(None),
            }
        }
        Ok(if atoms.len() == 1 {
            atoms.pop().flatten()
        } else {
            None
        })
    }

    pub(crate) fn keyframes(&mut self, parser: &mut Parser<'_, '_>) -> Result<()> {
        let mut local = true;
        while !parser.is_exhausted() {
            let start = parser.position().byte_index();
            let Ok(token) = parser.next_including_whitespace_and_comments().cloned() else {
                break;
            };
            let end = parser.position().byte_index();
            match token {
                Token::Ident(name) if local => self.identifier(&name, start, end, false),
                Token::QuotedString(name) if local => {
                    let name = self.name(&name);
                    let mut escaped = String::new();
                    let _ = cssparser::serialize_string(&name, &mut escaped);
                    self.edits.push((start, end, escaped));
                }
                Token::Colon => {
                    if let Ok(Token::Function(name)) = parser.next().cloned()
                        && (name == "local" || name == "global")
                    {
                        let function_end = parser.position().byte_index();
                        let mut result = Ok(());
                        let _: result::Result<_, ParseError<'_, ()>> =
                            parser.parse_nested_block(|nested| {
                                if name == "local" {
                                    result = self.keyframes(nested);
                                } else {
                                    while nested.next().is_ok() {}
                                }
                                Ok(())
                            });
                        result?;
                        self.edits.push((start, function_end, String::new()));
                        self.edits.push((
                            parser.position().byte_index() - 1,
                            parser.position().byte_index(),
                            String::new(),
                        ));
                        local = false;
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }

    fn icss(&self, offset: usize, selector: &str) -> error::CssError {
        let (line, column) = self.position(offset);
        error::CssError::Transform {
            kind: error::TransformFailure::Modules,
            message: format!(
                "CSS Modules authored ICSS rule is unsupported in {}:{line}:{column}: {selector}; use local class exports or ordinary CSS",
                self.path
            ),
        }
    }
}
