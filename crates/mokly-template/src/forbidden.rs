//! Find forbidden statements and direct uses of the safe filter or test.

use std::ops::Range;

use minijinja::machinery::{Span, Token};

use crate::error::{ForbiddenKind, ForbiddenUse};

/// With `multi_template` disabled, the parser has no AST nodes for these statements.
pub(crate) fn inspect_tag(
    statement: bool,
    source: Range<usize>,
    tokens: &[(Token<'_>, Span)],
    uses: &mut Vec<ForbiddenUse>,
) {
    let head = tokens.first().map(|(token, _)| token);
    if statement {
        let kind = match head {
            Some(Token::Ident("include")) => Some(ForbiddenKind::Include),
            Some(Token::Ident("import")) => Some(ForbiddenKind::Import),
            Some(Token::Ident("from")) => Some(ForbiddenKind::From),
            Some(Token::Ident("extends")) => Some(ForbiddenKind::Extends),
            Some(Token::Ident("block")) => Some(ForbiddenKind::Block),
            Some(Token::Ident("autoescape")) => Some(ForbiddenKind::AutoEscape),
            _ => None,
        };
        if let Some(kind) = kind {
            uses.push(ForbiddenUse { kind, source });
        }
    }
    for (index, (token, span)) in tokens.iter().enumerate() {
        let before = &tokens[..index];
        if matches!(token, Token::Ident("safe"))
            && !matches!(tokens.get(index + 1), Some((Token::Dot, _)))
            && ((statement && index == 1 && matches!(head, Some(Token::Ident("filter"))))
                || matches!(before.last(), Some((Token::Pipe, _)))
                || is_test(before))
        {
            uses.push(ForbiddenUse {
                kind: ForbiddenKind::Safe,
                source: span.start_offset as usize..span.end_offset as usize,
            });
        }
    }
}

fn is_test(tokens: &[(Token<'_>, Span)]) -> bool {
    let tokens = match tokens {
        [head @ .., (Token::Ident("not"), _)] => head,
        _ => tokens,
    };
    match tokens {
        [.., (Token::Dot, _), (Token::Ident("is"), _)] => false,
        [.., (Token::Ident("is"), _)] => true,
        _ => false,
    }
}
