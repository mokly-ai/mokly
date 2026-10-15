//! Plain listening bytes and bounded rich Serve header and URL panel.

use std::time::Duration;

use crate::build::BuildSummary;
use crate::build_output;
use crate::output::{Mode, Style, bounded};
use crate::redaction::Redactor;
use crate::version::VERSION;

/// Render only the stable ready address and its requested watch mode.
pub fn ready(
    style: &Style,
    url: &str,
    config: &str,
    base: &str,
    watching: bool,
    interactive: bool,
    redactor: &Redactor,
) -> String {
    if style.mode == Mode::Plain {
        return format!(
            "Mokly listening at {url}{}\n",
            if watching { " (watching)" } else { "" }
        );
    }
    let config = redactor.safe(config);
    let base = redactor.safe(base);
    let width = style.columns.saturating_sub(8).clamp(1, 120);
    let address = bounded(url, width);
    let count = unicode_width::UnicodeWidthStr::width(address.as_str());
    let (top_left, top_right, bottom_left, bottom_right, horizontal, vertical) = if style.ascii {
        ("+", "+", "+", "+", "-", "|")
    } else {
        ("┌", "┐", "└", "┘", "─", "│")
    };
    let border = horizontal.repeat(count + 4);
    let lines = [
        columns(
            &format!("  mokly {VERSION}"),
            &format!("comparing against {base}"),
            style.columns,
        ),
        format!("  {config}"),
        String::new(),
        format!("  {top_left}{border}{top_right}"),
        format!("  {vertical}  {address}  {vertical}"),
        format!("  {bottom_left}{border}{bottom_right}"),
        format!(
            "  {}{}",
            if watching {
                "watching sources and styles"
            } else {
                "snapshot"
            },
            if interactive {
                " · press h for shortcuts"
            } else {
                ""
            }
        ),
    ];
    lines
        .into_iter()
        .enumerate()
        .map(|(index, line)| {
            let line = bounded(&line, style.columns);
            if style.color && (3..=5).contains(&index) {
                format!(
                    "\x1b[{}m{line}\x1b[0m\n",
                    if index == 4 { "1;36" } else { "36" }
                )
            } else if style.color && index == 6 {
                format!("\x1b[2m{line}\x1b[0m\n")
            } else {
                format!("{line}\n")
            }
        })
        .collect()
}

/// Exact shortcut actions for rich watched Serve.
pub fn shortcuts(style: &Style) -> String {
    "  o  Open the catalogue\n  r  Rebuild the catalogue\n  c  Clear the terminal\n  h  Show shortcuts\n  q  Close Serve\n  Ctrl+C  Close Serve\n".lines().map(|line| format!("{}\n", bounded(line, style.columns))).collect()
}

/// Completed preparation keeps elapsed time in its own right-aligned column.
pub fn catalogue(style: &Style, summary: &BuildSummary, elapsed: Duration) -> String {
    if style.mode == Mode::Plain {
        return String::new();
    }
    let full = Style {
        columns: usize::MAX,
        ..style.clone()
    };
    let line = columns(
        build_output::summary(&full, summary).trim_end(),
        &duration(elapsed),
        style.columns,
    );
    let glyph = if style.ascii { "+" } else { "✔" };
    let line = if style.color {
        line.replacen(glyph, &format!("\x1b[32m{glyph}\x1b[0m"), 1)
    } else {
        line
    };
    format!("{line}\n")
}

/// Report a concrete unavailable reason using the selected rich style.
pub fn changes_unavailable(style: &Style, reason: &str, redactor: &Redactor) -> String {
    if style.mode == Mode::Plain {
        return String::new();
    }
    let line = bounded(
        &format!("  ! Changes unavailable · {}", redactor.safe(reason)),
        style.columns,
    );
    let line = if style.color {
        line.replacen('!', "\x1b[33m!\x1b[0m", 1)
    } else {
        line
    };
    format!("{line}\n")
}

/// Report one listener backoff period through either terminal mode.
pub fn accept_failure(style: &Style, reason: &str, redactor: &Redactor) -> String {
    accept_line(
        style,
        &format!(
            "! Serve cannot accept connections: {}. Retrying.",
            redactor.safe(reason)
        ),
    )
}

/// Report recovery once a listener accepts a connection again.
pub fn accept_recovery(style: &Style) -> String {
    accept_line(style, "! Serve can accept connections again.")
}

fn accept_line(style: &Style, line: &str) -> String {
    if style.mode == Mode::Plain {
        return format!("{line}\n");
    }
    let line = bounded(&format!("  {line}"), style.columns);
    let line = if style.color {
        line.replacen('!', "\x1b[33m!\x1b[0m", 1)
    } else {
        line
    };
    format!("{line}\n")
}

fn columns(left: &str, right: &str, width: usize) -> String {
    let right_width = unicode_width::UnicodeWidthStr::width(right);
    if width <= right_width + 3 {
        return bounded(&format!("{left} {right}"), width);
    }
    let left = bounded(left, width - right_width - 1);
    let gap =
        width.saturating_sub(unicode_width::UnicodeWidthStr::width(left.as_str()) + right_width);
    format!("{left}{}{right}", " ".repeat(gap))
}

fn duration(value: Duration) -> String {
    if value < Duration::from_secs(1) {
        format!("{:.0}ms", value.as_secs_f64() * 1000.0)
    } else if value < Duration::from_secs(60) {
        format!("{:.1}s", value.as_secs_f64())
    } else {
        format!("{}m {:02}s", value.as_secs() / 60, value.as_secs() % 60)
    }
}

#[cfg(test)]
#[path = "_tests_/serve_output_tests.rs"]
mod serve_output_tests;
