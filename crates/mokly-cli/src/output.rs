//! Pure reporter selection, error presentation and terminal-width bounds.

use unicode_width::UnicodeWidthChar;

use crate::errors::Code;
use crate::redaction::Redactor;

/// Selected terminal reporter.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Mode {
    /// Stable automation output.
    Plain,
    /// Interactive presentation, optionally forced through a pipe.
    Rich,
}

/// Select one reporter before command work starts.
pub fn select(debug_timings: bool, output: Option<&str>, ci: Option<&str>, tty: bool) -> Mode {
    if debug_timings || output == Some("plain") {
        return Mode::Plain;
    }
    if output == Some("rich") {
        return Mode::Rich;
    }
    if ci.is_some_and(|ci| !ci.is_empty()) {
        return Mode::Plain;
    }
    if tty { Mode::Rich } else { Mode::Plain }
}

/// Presentation settings read by the binary, independently of mode selection.
pub struct Style {
    /// Selected reporter.
    pub mode: Mode,
    /// Whether the error stream supports colour.
    pub color: bool,
    /// Use ASCII glyphs on an older Windows console.
    pub ascii: bool,
    /// Positive stdout width, or 80 when unavailable.
    pub columns: usize,
}

impl Style {
    /// Render a complete expected error with no stack or progress frames.
    pub fn error(&self, code: Code, message: &str, redactor: &Redactor) -> String {
        let fixed_upload = matches!(code, Code::UploadCancelled | Code::UploadTransport);
        let (code, headline, hint) = code.presentation();
        let message = if fixed_upload {
            redactor.safe(&format!("{headline} {hint}"))
        } else {
            redactor.safe(message)
        };
        if self.mode == Mode::Plain {
            return format!("[mokly/{code}] {message}\n");
        }
        let (headline, hint) = if let Some(candidate) = message.strip_prefix("unknown command: ") {
            (
                format!("Unknown command \"{candidate}\"."),
                closest_command(candidate).map_or_else(
                    || hint.to_owned(),
                    |command| format!("Run `mokly {command}`."),
                ),
            )
        } else if let Some(option) = message.strip_prefix("unknown option: ") {
            (format!("Unknown option \"{option}\"."), hint.to_owned())
        } else {
            (headline.to_owned(), hint.to_owned())
        };
        let headline = redactor.safe(&headline);
        let hint = redactor.safe(&hint);
        let glyph = if self.ascii { "x" } else { "✖" };
        let tag = if self.color {
            format!("\x1b[2m[mokly/{code}]\x1b[0m")
        } else {
            format!("[mokly/{code}]")
        };
        let mut lines = vec![format!("{glyph} {headline}  {tag}")];
        if !fixed_upload
            && !message.is_empty()
            && message != headline
            && !message.starts_with("unknown command: ")
            && !message.starts_with("unknown option: ")
        {
            lines.push(format!("  {message}"));
        }
        lines.push(format!("  {hint}"));
        lines
            .into_iter()
            .map(|line| format!("{}\n", bounded(&line, self.columns)))
            .collect()
    }
}

/// Truncate by display columns, retaining complete ANSI CSI sequences.
pub fn bounded(text: &str, columns: usize) -> String {
    let columns = if columns > 0 { columns } else { 80 };
    let mut tokens = Vec::new();
    let mut characters = text.chars().peekable();
    let mut width = 0;
    while let Some(character) = characters.next() {
        if character == '\x1b' {
            let mut sequence = String::from(character);
            if characters.next() != Some('[') {
                continue;
            }
            sequence.push('[');
            let mut complete = false;
            for character in characters.by_ref() {
                sequence.push(character);
                if ('@'..='~').contains(&character) {
                    complete = true;
                    break;
                }
            }
            if complete {
                tokens.push((sequence, 0));
            }
        } else {
            let size = character.width().unwrap_or(0);
            width += size;
            tokens.push((character.to_string(), size));
        }
    }
    if width <= columns {
        return tokens.into_iter().map(|(token, _)| token).collect();
    }
    let mut result = String::new();
    let mut kept = 0;
    let mut styled = false;
    for (token, width) in tokens {
        if kept + width > columns - 1 {
            break;
        }
        styled |= token.starts_with('\x1b');
        kept += width;
        result.push_str(&token);
    }
    result.push('…');
    if styled {
        result.push_str("\x1b[0m");
    }
    result
}

fn closest_command(candidate: &str) -> Option<&'static str> {
    let mut distances: Vec<_> = ["serve", "build", "publish"]
        .into_iter()
        .map(|command| (distance(candidate, command), command))
        .collect();
    distances.sort_unstable();
    if distances[0].0 <= 3 && distances[0].0 < distances[1].0 {
        Some(distances[0].1)
    } else {
        None
    }
}

fn distance(left: &str, right: &str) -> usize {
    let right: Vec<_> = right.chars().collect();
    let mut row: Vec<_> = (0..=right.len()).collect();
    for (index, left) in left.chars().enumerate() {
        let mut next = vec![index + 1];
        for (column, right) in right.iter().enumerate() {
            next.push(
                (row[column] + usize::from(left != *right))
                    .min(row[column + 1] + 1)
                    .min(next[column] + 1),
            );
        }
        row = next;
    }
    row[right.len()]
}

#[cfg(test)]
#[path = "_tests_/output_tests.rs"]
mod output_tests;
