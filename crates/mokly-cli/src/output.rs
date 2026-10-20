//! Pure reporter selection, error presentation and terminal-width bounds.

use unicode_width::UnicodeWidthChar;

use crate::codes::Code;
use crate::errors::Failure;
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
#[derive(Clone)]
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
    /// Render a typed CLI failure without changing its fixed code prefix.
    pub fn failure(&self, failure: &Failure, redactor: &Redactor) -> String {
        if let Failure::Unavailable { .. } = failure {
            return format!("[mokly/build-invalid] {}\n", failure.detail());
        }
        let (_, headline, hint) = Code::CliInvalid.presentation();
        match failure {
            Failure::UnknownCommand { candidate } => {
                let plain = format!("unknown command: {}", redactor.safe(candidate));
                if self.mode == Mode::Plain {
                    return format!("[mokly/cli-invalid] {plain}\n");
                }
                let hint = closest_command(candidate).map_or_else(
                    || hint.to_owned(),
                    |command| format!("Run `mokly {command}`."),
                );
                self.rich(
                    "cli-invalid",
                    &format!("Unknown command \"{}\".", redactor.safe(candidate)),
                    &hint,
                    None,
                )
            }
            Failure::UnknownOption { option } => {
                let option = redactor.safe(option);
                if self.mode == Mode::Plain {
                    return format!("[mokly/cli-invalid] unknown option: {option}\n");
                }
                self.rich(
                    "cli-invalid",
                    &format!("Unknown option \"{option}\"."),
                    hint,
                    None,
                )
            }
            _ => {
                let detail = match failure {
                    Failure::ShortFlag { option } => format!(
                        "short flag cannot have trailing text: {}",
                        redactor.safe(option)
                    ),
                    Failure::BooleanAssignment { option } => format!(
                        "boolean option does not take a value: {}",
                        redactor.safe(option)
                    ),
                    Failure::RepeatedOption { option } => {
                        format!("option cannot be repeated: {}", redactor.safe(option))
                    }
                    Failure::SeparateHyphen { option } => format!(
                        "{} needs a value; use its assigned form for a value starting with -",
                        redactor.safe(option)
                    ),
                    Failure::Syntax { .. } => redactor.safe(&failure.detail()),
                    _ => failure.detail(),
                };
                if self.mode == Mode::Plain {
                    return format!("[mokly/cli-invalid] {detail}\n");
                }
                self.rich("cli-invalid", headline, hint, Some(&detail))
            }
        }
    }

    /// Render a typed command category with safe variable detail.
    pub fn error(&self, code: Code, message: &str, redactor: &Redactor) -> String {
        self.error_text(code, message, redactor, false)
    }

    /// Keep a case-specific recovery in the plain line or the single rich hint.
    pub(crate) fn error_with_recovery(
        &self,
        code: Code,
        message: &str,
        recovery: &str,
        redactor: &Redactor,
    ) -> String {
        let (code, headline, _) = code.presentation();
        let message = redactor.safe(message);
        let recovery = redactor.safe(recovery);
        if self.mode == Mode::Plain {
            return format!("[mokly/{code}] {message} {recovery}\n");
        }
        self.rich(code, headline, &recovery, Some(&message))
    }

    /// Present the structural continuation lines of a catalogue identity diagnostic.
    pub(crate) fn error_lines(&self, code: Code, message: &str, redactor: &Redactor) -> String {
        self.error_text(code, message, redactor, true)
    }

    fn error_text(&self, code: Code, message: &str, redactor: &Redactor, lines: bool) -> String {
        let fixed_upload = matches!(code, Code::UploadCancelled | Code::UploadTransport);
        let (code, headline, hint) = code.presentation();
        let message = if fixed_upload {
            format!("{headline} {hint}")
        } else if lines {
            redactor.safe_lines(message)
        } else {
            redactor.safe(message)
        };
        if self.mode == Mode::Plain {
            return format!("[mokly/{code}] {message}\n");
        }
        let detail = message.strip_prefix(headline).unwrap_or(&message).trim();
        let detail = detail.strip_suffix(hint).unwrap_or(detail).trim();
        let detail = if fixed_upload || detail.is_empty() {
            None
        } else {
            Some(detail)
        };
        self.rich(code, headline, hint, detail)
    }

    fn rich(&self, code: &str, headline: &str, hint: &str, detail: Option<&str>) -> String {
        let glyph = if self.ascii { "x" } else { "✖" };
        let tag = if self.color {
            format!("\x1b[2m[mokly/{code}]\x1b[0m")
        } else {
            format!("[mokly/{code}]")
        };
        let mut lines = vec![format!("{glyph} {headline}  {tag}")];
        if let Some(detail) = detail {
            lines.extend(detail.split('\n').map(|line| format!("  {line}")));
        }
        lines.push(format!("  {hint}"));
        lines
            .into_iter()
            .map(|line| format!("{}\n", bounded(&line, self.columns)))
            .collect()
    }
}

/// Format a warning glyph and line while preserving the caller's ANSI truncation order.
/// Changes bounds styled bytes; Serve bounds plain bytes before coloring its glyph.
pub fn warning_line(style: &Style, message: &str, color_before_limit: bool) -> String {
    if style.mode == Mode::Plain {
        return format!("! {message}\n");
    }
    let glyph = if style.color { "\x1b[33m!\x1b[0m" } else { "!" };
    let line = format!("  ! {message}");
    let line = if color_before_limit {
        bounded(&line.replacen('!', glyph, 1), style.columns)
    } else {
        bounded(&line, style.columns).replacen('!', glyph, 1)
    };
    format!("{line}\n")
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
