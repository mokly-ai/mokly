//! Plain listening bytes and bounded rich Serve header and URL panel.

use std::time::Duration;

use mokly_compare::comparison_types::ComparisonCounts;

use crate::build::BuildSummary;
use crate::output::{Mode, Style, bounded, warning_line};
use crate::redaction::Redactor;
use crate::version::VERSION;
use crate::{build_output, changes_output};

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
    ReadyPanel {
        version: VERSION,
        url,
        config,
        base,
        watching,
        interactive,
    }
    .render(style, redactor)
}

/// The ready output's inputs; tests render it with a fixed version.
pub(crate) struct ReadyPanel<'a> {
    /// Version in the rich header, the embedded release outside tests.
    pub(crate) version: &'a str,
    /// Listening address.
    pub(crate) url: &'a str,
    /// Configuration path under the header.
    pub(crate) config: &'a str,
    /// Comparison base in the header.
    pub(crate) base: &'a str,
    /// Whether Serve watches sources and styles.
    pub(crate) watching: bool,
    /// Whether keyboard shortcuts are available.
    pub(crate) interactive: bool,
}

impl ReadyPanel<'_> {
    /// Render the plain listening line or the bounded rich panel.
    pub(crate) fn render(&self, style: &Style, redactor: &Redactor) -> String {
        let Self {
            version,
            url,
            config,
            base,
            watching,
            interactive,
        } = *self;
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
        let (top_left, top_right, bottom_left, bottom_right, horizontal, vertical) = if style.ascii
        {
            ("+", "+", "+", "+", "-", "|")
        } else {
            ("┌", "┐", "└", "┘", "─", "│")
        };
        let border = horizontal.repeat(count + 4);
        let lines = [
            columns(
                &format!("  mokly {version}"),
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
        build_output::catalogue_summary(&full, summary).trim_end(),
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

/// Report accepted Changes counts with a separate elapsed-time column.
pub fn changes_ready(
    style: &Style,
    changes: usize,
    moved: usize,
    ignored: usize,
    elapsed: Duration,
) -> String {
    if style.mode == Mode::Plain {
        return String::new();
    }
    let glyph = if style.ascii { "+" } else { "✔" };
    let full = Style {
        color: false,
        columns: usize::MAX,
        ..style.clone()
    };
    let summary = changes_output::ready(
        &full,
        ComparisonCounts {
            changes,
            moved,
            ignored_only: ignored,
        },
    );
    let line = columns(summary.trim_end(), &duration(elapsed), style.columns);
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
    warning_line(
        style,
        &format!("Changes unavailable · {}", redactor.safe(reason)),
        false,
    )
}

/// Report one listener backoff period through either terminal mode.
pub fn accept_failure(style: &Style, reason: &str, redactor: &Redactor) -> String {
    warning_line(
        style,
        &format!(
            "Serve cannot accept connections: {}. Retrying.",
            redactor.safe(reason)
        ),
        false,
    )
}

/// Report recovery once a listener accepts a connection again.
pub fn accept_recovery(style: &Style) -> String {
    warning_line(style, "Serve can accept connections again.", false)
}

pub(crate) fn columns(left: &str, right: &str, width: usize) -> String {
    let right_width = unicode_width::UnicodeWidthStr::width(right);
    if width <= right_width + 3 {
        return bounded(&format!("{left} {right}"), width);
    }
    let left = bounded(left, width - right_width - 1);
    let gap =
        width.saturating_sub(unicode_width::UnicodeWidthStr::width(left.as_str()) + right_width);
    format!("{left}{}{right}", " ".repeat(gap))
}

pub(crate) fn duration(value: Duration) -> String {
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
