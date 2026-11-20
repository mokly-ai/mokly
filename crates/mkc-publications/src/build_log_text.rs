//! Safe display text shared by build checks and build log readers.

use std::iter::Peekable;
use std::str::Chars;

/// Decode redacted bytes, remove terminal escapes and normalize line endings.
pub fn normalize(bytes: &[u8]) -> String {
    let decoded = String::from_utf8_lossy(bytes);
    let mut chars = decoded.chars().peekable();
    let mut output = String::new();
    while let Some(character) = chars.next() {
        match character {
            '\u{1b}' => skip_escape(&mut chars),
            '\u{9b}' => skip_csi(&mut chars),
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                output.push('\n');
            }
            '\n' | '\t' => output.push(character),
            value if !value.is_control() => output.push(value),
            _ => {}
        }
    }
    output
}

fn skip_escape(chars: &mut Peekable<Chars<'_>>) {
    match chars.next() {
        Some('[') => skip_csi(chars),
        Some(']' | 'P' | 'X' | '^' | '_') => {
            while let Some(character) = chars.next() {
                if character == '\u{7}' || character == '\u{9c}' {
                    break;
                }
                if character == '\u{1b}' && chars.peek() == Some(&'\\') {
                    chars.next();
                    break;
                }
            }
        }
        Some(' '..='/') => {
            for character in chars.by_ref() {
                if ('0'..='~').contains(&character) {
                    break;
                }
            }
        }
        _ => {}
    }
}

fn skip_csi(chars: &mut Peekable<Chars<'_>>) {
    for character in chars.by_ref() {
        if ('@'..='~').contains(&character) {
            break;
        }
    }
}

#[cfg(test)]
#[path = "_tests_/build_log_text_tests.rs"]
mod tests;
