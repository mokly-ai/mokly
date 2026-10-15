//! Token-based CSS references preserve comments, escapes, strings, and nesting.

use std::result;

use cssparser::{ParseError, Parser, ParserInput, Token};

use crate::error;

/// A CSS URL reference with a replaceable byte range.
#[derive(Clone, Debug)]
pub struct Reference {
    /// Decoded URL or import specifier.
    pub value: String,
    /// Byte start in the effective stylesheet.
    pub start: usize,
    /// Byte end in the effective stylesheet.
    pub end: usize,
    /// True for an import prelude.
    pub import: bool,
    /// True for a quoted local image-set candidate.
    pub image_set_string: bool,
    /// Complete import-rule byte range for renderer pruning.
    pub rule: Option<(usize, usize)>,
    /// True for a local import after a style rule.
    pub late: bool,
}

/// Extract nested URL functions and prelude imports without matching source strings.
pub fn references(source: &str) -> Vec<Reference> {
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    let mut output = Vec::new();
    scan(&mut parser, false, &mut output);
    output
}

fn scan(parser: &mut Parser<'_, '_>, image_set: bool, output: &mut Vec<Reference>) {
    let mut import = false;
    let mut import_start = 0;
    let mut rule = false;
    let mut current_import = None;
    while !parser.is_exhausted() {
        let start = parser.position().byte_index();
        let Ok(token) = parser.next_including_whitespace_and_comments().cloned() else {
            break;
        };
        let mut end = parser.position().byte_index();
        match token {
            Token::AtKeyword(name) if name.eq_ignore_ascii_case("import") => {
                import = true;
                import_start = start;
            }
            Token::QuotedString(value) if import || image_set => {
                current_import = import.then_some(output.len());
                output.push(Reference {
                    value: value.to_string(),
                    start,
                    end,
                    import,
                    image_set_string: image_set && !import,
                    rule: None,
                    late: rule,
                });
                import = false;
            }
            Token::UnquotedUrl(value) => {
                current_import = import.then_some(output.len());
                output.push(Reference {
                    value: value.to_string(),
                    start,
                    end,
                    import,
                    image_set_string: false,
                    rule: None,
                    late: rule,
                });
                import = false;
            }
            Token::Function(name) if name.eq_ignore_ascii_case("url") => {
                let parsed: result::Result<_, ParseError<'_, ()>> =
                    parser.parse_nested_block(|nested| Ok(nested.expect_string()?.to_string()));
                end = parser.position().byte_index();
                if let Ok(value) = parsed {
                    current_import = import.then_some(output.len());
                    output.push(Reference {
                        value,
                        start,
                        end,
                        import,
                        image_set_string: false,
                        rule: None,
                        late: rule,
                    });
                }
                import = false;
            }
            Token::Semicolon => {
                if let Some(index) = current_import.take() {
                    output[index].rule = Some((import_start, end));
                }
                import = false;
            }
            Token::Function(name) => {
                let is_image_set = name.eq_ignore_ascii_case("image-set")
                    || name.eq_ignore_ascii_case("-webkit-image-set");
                let _: result::Result<_, ParseError<'_, ()>> =
                    parser.parse_nested_block(|nested| {
                        scan(nested, is_image_set, output);
                        Ok(())
                    });
            }
            Token::CurlyBracketBlock => {
                rule = true;
                let _: result::Result<_, ParseError<'_, ()>> =
                    parser.parse_nested_block(|nested| {
                        scan(nested, false, output);
                        Ok(())
                    });
            }
            Token::SquareBracketBlock | Token::ParenthesisBlock => {
                let _: result::Result<_, ParseError<'_, ()>> =
                    parser.parse_nested_block(|nested| {
                        scan(nested, false, output);
                        Ok(())
                    });
            }
            _ => {}
        }
    }
    if let Some(index) = current_import {
        output[index].rule = Some((import_start, parser.position().byte_index()));
    }
}

/// Replace non-overlapping source ranges from the end, keeping all other text.
pub(crate) fn replace(
    path: &str,
    source: &str,
    mut edits: Vec<(usize, usize, String)>,
) -> error::Result<String> {
    edits.sort_by_key(|edit| edit.0);
    let mut text = source.to_owned();
    for (start, end, replacement) in edits.into_iter().rev() {
        if text.get(start..end).is_none() {
            return Err(error::CssError::Transform {
                kind: error::TransformFailure::Syntax,
                message: format!(
                    "could not transform CSS {path}: invalid source range; fix the stylesheet and rebuild"
                ),
            });
        }
        text.replace_range(start..end, &replacement);
    }
    Ok(text)
}
