//! Template tag boundaries, authored names, and a source with only tags blanked.

use std::collections::BTreeSet;
use std::ops::Range;

use minijinja::machinery::{Token, Tokenizer};
use minijinja::syntax::SyntaxConfig;
use minijinja::{Error, ErrorKind};

use crate::error::{ForbiddenUse, TemplateError};
use crate::forbidden::inspect_tag;

pub(crate) struct Tag {
    pub(crate) source: Range<usize>,
    pub(crate) content: Range<usize>,
    pub(crate) statement: bool,
}

pub(crate) struct Lexed<'a> {
    pub(crate) blanked: String,
    pub(crate) tags: Vec<Tag>,
    pub(crate) forbidden: Vec<ForbiddenUse>,
    identifiers: BTreeSet<&'a str>,
}

impl Lexed<'_> {
    /// Find a lookup name no authored expression or assignment can access.
    pub(crate) fn private_name(&self, base: &str) -> String {
        let mut candidate = base.to_owned();
        while self.identifiers.contains(candidate.as_str()) {
            candidate.push('_');
        }
        candidate
    }
}

pub(crate) fn scan<'a>(
    source: &'a str,
    name: &'a str,
    syntax: SyntaxConfig,
) -> Result<Lexed<'a>, TemplateError> {
    let mut tokenizer = Tokenizer::new(source, name, false, syntax);
    let mut lexed = Lexed {
        blanked: source.to_owned(),
        tags: Vec::new(),
        forbidden: Vec::new(),
        identifiers: BTreeSet::new(),
    };
    let mut cursor = 0;
    loop {
        match tokenizer.next_token() {
            Ok(Some((token, span))) => {
                let start = span.start_offset as usize;
                blank_hidden(&mut lexed.blanked, source, cursor..start);
                cursor = span.end_offset as usize;
                if matches!(token, Token::VariableStart | Token::BlockStart) {
                    let statement = matches!(token, Token::BlockStart);
                    let tag = read_tag(&mut tokenizer, &mut lexed, start..cursor, statement)?;
                    cursor = tag.source.end;
                    blank(&mut lexed.blanked, source, tag.source.clone());
                    lexed.tags.push(tag);
                }
            }
            Ok(None) => {
                blank_hidden(&mut lexed.blanked, source, cursor..source.len());
                return Ok(lexed);
            }
            Err(error) => {
                let offset = unclosed_hidden_tag(source, cursor)
                    .or_else(|| error.range().map(|range| range.start.min(source.len())));
                return Err(TemplateError::Syntax {
                    offset,
                    source: error,
                });
            }
        }
    }
}

fn read_tag<'a>(
    tokenizer: &mut Tokenizer<'a>,
    lexed: &mut Lexed<'a>,
    opening: Range<usize>,
    statement: bool,
) -> Result<Tag, TemplateError> {
    let mut tokens = Vec::new();
    let error = loop {
        match tokenizer.next_token() {
            Ok(Some((Token::VariableEnd | Token::BlockEnd, span))) => {
                let source = opening.start..span.end_offset as usize;
                inspect_tag(statement, source.clone(), &tokens, &mut lexed.forbidden);
                return Ok(Tag {
                    source,
                    content: opening.end..span.start_offset as usize,
                    statement,
                });
            }
            Ok(Some((token, span))) => {
                if let Token::Ident(name) = token {
                    lexed.identifiers.insert(name);
                }
                tokens.push((token, span));
            }
            Ok(None) => break Error::new(ErrorKind::SyntaxError, "unclosed template tag"),
            Err(error) => break error,
        }
    };
    Err(TemplateError::Syntax {
        offset: Some(opening.start),
        source: error,
    })
}

/// MiniJinja skips comments and raw delimiters. Only those tags occur between its tokens.
fn blank_hidden(blanked: &mut String, source: &str, gap: Range<usize>) {
    let mut start = gap.start;
    while let Some((relative, close)) = hidden_tag(&source[start..gap.end]) {
        let tag = start + relative;
        let content = tag + 2;
        let Some(end) = source[content..gap.end].find(close) else {
            break;
        };
        start = content + end + close.len();
        blank(blanked, source, tag..start);
    }
}

fn hidden_tag(text: &str) -> Option<(usize, &'static str)> {
    text.as_bytes()
        .windows(2)
        .enumerate()
        .find_map(|(index, pair)| match pair {
            b"{#" => Some((index, "#}")),
            b"{%" => Some((index, "%}")),
            _ => None,
        })
}

/// A complete raw block produces a data token before the lexer goes on to the next tag.
fn unclosed_hidden_tag(source: &str, mut cursor: usize) -> Option<usize> {
    while let Some((relative, close)) = hidden_tag(&source[cursor..]) {
        let start = cursor + relative;
        let content = start + 2;
        let Some(end) = source[content..].find(close) else {
            return Some(start);
        };
        if close == "%}"
            && source[content..content + end]
                .trim_matches(|ch: char| ch.is_ascii_whitespace() || matches!(ch, '-' | '+'))
                == "raw"
        {
            return Some(start);
        }
        cursor = content + end + close.len();
    }
    None
}

fn blank(blanked: &mut String, source: &str, range: Range<usize>) {
    let spaces: String = source[range.clone()]
        .bytes()
        .map(|byte| {
            if matches!(byte, b'\r' | b'\n') {
                char::from(byte)
            } else {
                ' '
            }
        })
        .collect();
    blanked.replace_range(range, &spaces);
}
