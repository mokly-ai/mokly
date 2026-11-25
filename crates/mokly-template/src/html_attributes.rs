//! Locate whole-value expressions in authored HTML start tags.

use std::ops::Range;

use html5gum::emitters::callback::{CallbackEmitter, CallbackEvent};
use html5gum::{Span, Tokenizer, naive_next_state};

use crate::lexer::{Lexed, Tag};

pub(crate) struct Attribute<'a> {
    pub(crate) name: &'a str,
    pub(crate) source: Range<usize>,
    pub(crate) open_expression: usize,
    pub(crate) unquoted: bool,
    pub(crate) dynamic_name: bool,
}

pub(crate) fn whole_values<'a>(source: &'a str, lexed: &Lexed<'_>) -> Vec<Attribute<'a>> {
    let expressions: Vec<_> = lexed.tags.iter().filter(|tag| !tag.statement).collect();
    if expressions.is_empty() {
        return Vec::new();
    }
    // Put non-whitespace placeholders in expression positions for unquoted values.
    let mut scan = lexed.blanked.clone();
    for tag in &expressions {
        scan.replace_range(tag.source.clone(), &"x".repeat(tag.source.len()));
    }
    let mut attributes = Vec::new();
    let mut pending = Vec::new();
    let mut next_state = None;
    let emitter =
        CallbackEmitter::new(|event: CallbackEvent<'_>, span: Span| {
            match event {
                CallbackEvent::OpenStartTag { name } => {
                    pending.clear();
                    // Mokly parses authored HTML with scripting disabled.
                    next_state = (name != b"noscript")
                        .then(|| naive_next_state(name))
                        .flatten();
                }
                CallbackEvent::AttributeName { .. } => pending.push(span.start..span.end),
                CallbackEvent::CloseStartTag { .. } => {
                    attributes.extend(pending.drain(..).filter_map(|name| {
                        whole_value(source, &scan, name, span.end, &expressions)
                    }));
                    return next_state.take();
                }
                _ => {}
            }
            None
        });
    let mut tokens = Tokenizer::new_with_emitter(scan.as_str(), emitter);
    while let Some(result) = tokens.next() {
        match result {
            Ok(state) => tokens.set_state(state),
            Err(error) => match error {},
        }
    }
    attributes
}

fn whole_value<'a>(
    source: &'a str,
    scan: &str,
    name: Range<usize>,
    tag_end: usize,
    expressions: &[&Tag],
) -> Option<Attribute<'a>> {
    let name_text = source.get(name.clone())?;
    if name_text.is_empty() {
        return None;
    }
    let dynamic_name = name_text != scan.get(name.clone())?;
    let value = scan
        .get(name.end..tag_end)?
        .trim_start_matches(html_space)
        .strip_prefix('=')?
        .trim_start_matches(html_space);
    let start = tag_end - value.len();
    let first = value.as_bytes().first()?;
    let (expression, end, unquoted) = if matches!(first, b'\'' | b'"') {
        let close = value[1..].find(char::from(*first))? + 1;
        (start + 1..start + close, start + close + 1, false)
    } else {
        let length = value.find(|c| html_space(c) || c == '>')?;
        (start..start + length, start + length, true)
    };
    let index = expressions.partition_point(|tag| tag.source.start < expression.start);
    (expressions.get(index)?.source == expression
        && source.get(name.end..expression.start)? == scan.get(name.end..expression.start)?)
    .then_some(Attribute {
        name: name_text,
        source: name.start..end,
        open_expression: expression.start,
        unquoted,
        dynamic_name,
    })
}

fn html_space(c: char) -> bool {
    matches!(c, ' ' | '\t' | '\n' | '\r' | '\u{c}')
}
