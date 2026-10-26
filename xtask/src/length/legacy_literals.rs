//! The string and numeric literals of the legacy `oversizedCaps` table, read
//! as JavaScript reads them.

use std::sync::LazyLock;

use regex::Regex;

/// A JavaScript numeric literal, with a `bigint` suffix when present. A
/// pattern that does not compile reads as no literal, so the entry fails.
static NUMBER: LazyLock<Option<Regex>> = LazyLock::new(|| {
    Regex::new(concat!(
        r"^(?:0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+",
        r"|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9_]+)?",
        r"|\.[0-9][0-9_]*(?:[eE][+-]?[0-9_]+)?)n?",
    ))
    .ok()
});

/// The value and the byte length of the single- or double-quoted string
/// literal at the start of `text`, with its escapes read.
pub(super) fn string_literal(text: &str) -> Option<(String, usize)> {
    let quote = text
        .chars()
        .next()
        .filter(|quote| *quote == '"' || *quote == '\'')?;
    let mut characters = text[1..].char_indices().peekable();
    let mut value = String::new();
    while let Some((offset, character)) = characters.next() {
        if character == quote {
            return Some((value, 1 + offset + 1));
        }
        if character != '\\' {
            value.push(character);
            continue;
        }
        let (_, escaped) = characters.next()?;
        match escaped {
            'n' => value.push('\n'),
            'r' => value.push('\r'),
            't' => value.push('\t'),
            'b' => value.push('\u{8}'),
            'f' => value.push('\u{c}'),
            'v' => value.push('\u{b}'),
            '0' => value.push('\0'),
            'x' | 'u' => {
                let braced =
                    escaped == 'u' && characters.next_if(|(_, next)| *next == '{').is_some();
                let width = if escaped == 'x' { 2 } else { 4 };
                let mut digits = String::new();
                while let Some((_, digit)) =
                    characters.next_if(|(_, next)| next.is_ascii_hexdigit())
                {
                    digits.push(digit);
                    if !braced && digits.len() == width {
                        break;
                    }
                }
                if braced && characters.next_if(|(_, next)| *next == '}').is_none() {
                    return None;
                }
                value.push(char::from_u32(u32::from_str_radix(&digits, 16).ok()?)?);
            }
            '\r' => {
                characters.next_if(|(_, next)| *next == '\n');
            }
            '\n' => {}
            other => value.push(other),
        }
    }
    None
}

/// The value and the byte length of the numeric literal at the start of
/// `text`. A `bigint` literal is not a number.
pub(super) fn numeric_literal(text: &str) -> Option<(f64, usize)> {
    let found = NUMBER.as_ref()?.find(text)?.as_str();
    if found.ends_with('n') {
        return None;
    }
    let digits = found.replace('_', "");
    for (prefixes, radix) in [(['x', 'X'], 16), (['o', 'O'], 8), (['b', 'B'], 2)] {
        let Some(rest) = digits
            .strip_prefix('0')
            .and_then(|rest| rest.strip_prefix(prefixes))
        else {
            continue;
        };
        let value = u64::from_str_radix(rest, radix).ok()?;
        return Some((value as f64, found.len()));
    }
    Some((digits.parse().ok()?, found.len()))
}
