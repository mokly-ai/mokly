//! Token-based CSS references preserve comments, escapes, strings, and nesting.

use std::ops::Range;

use cssparser::{Parser, ParserInput, Token};

use crate::error;
use crate::token_tree::Tokens;

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
    let tokens = Tokens::new(source);
    let mut pending = vec![Scan::new(tokens.root(), false)];
    let mut output: Vec<Reference> = Vec::new();
    while let Some(mut frame) = pending.pop() {
        if tokens.next_significant(&mut frame.range.clone()).is_none() {
            if let Some(index) = frame.current_import {
                output[index].rule = Some((frame.import_start, tokens.offset(frame.range.start)));
            }
            continue;
        }
        let Some(index) = tokens.next(&mut frame.range) else {
            continue;
        };
        let node = &tokens.nodes[index];
        let mut nested = None;
        let value = match &node.token {
            Token::AtKeyword(name) if name.eq_ignore_ascii_case("import") => {
                frame.import = true;
                frame.import_start = node.start;
                None
            }
            Token::QuotedString(value) if frame.import || frame.image_set => Some((
                value.to_string(),
                node.end,
                frame.image_set && !frame.import,
            )),
            Token::UnquotedUrl(value) => Some((value.to_string(), node.end, false)),
            Token::Function(name) if name.eq_ignore_ascii_case("url") => {
                let value = url_string(tokens.body(index));
                if value.is_none() {
                    frame.import = false;
                }
                value.map(|value| (value, node.after, false))
            }
            Token::Semicolon => {
                if let Some(index) = frame.current_import.take() {
                    output[index].rule = Some((frame.import_start, node.end));
                }
                frame.import = false;
                None
            }
            Token::Function(name) => {
                let image_set = name.eq_ignore_ascii_case("image-set")
                    || name.eq_ignore_ascii_case("-webkit-image-set");
                nested = Some(Scan::new(tokens.children(index), image_set));
                None
            }
            Token::CurlyBracketBlock | Token::SquareBracketBlock | Token::ParenthesisBlock => {
                frame.rule |= matches!(node.token, Token::CurlyBracketBlock);
                nested = Some(Scan::new(tokens.children(index), false));
                None
            }
            _ => None,
        };
        if let Some((value, end, image_set_string)) = value {
            frame.current_import = frame.import.then_some(output.len());
            output.push(Reference {
                value,
                start: node.start,
                end,
                import: frame.import,
                image_set_string,
                rule: None,
                late: frame.rule,
            });
            frame.import = false;
        }
        pending.push(frame);
        if let Some(nested) = nested {
            pending.push(nested);
        }
    }
    output
}

/// The argument of `url()` when the block holds exactly one quoted string.
fn url_string(source: &str) -> Option<String> {
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    let value = parser.expect_string().ok()?.to_string();
    parser.expect_exhausted().ok()?;
    Some(value)
}

/// One block level of the scan. Import and rule state is local to each level.
struct Scan {
    range: Range<usize>,
    image_set: bool,
    import: bool,
    import_start: usize,
    current_import: Option<usize>,
    rule: bool,
}

impl Scan {
    fn new(range: Range<usize>, image_set: bool) -> Self {
        Self {
            range,
            image_set,
            import: false,
            import_start: 0,
            current_import: None,
            rule: false,
        }
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
