//! Plain listening bytes and bounded rich Serve header and URL panel.

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
    let width = style.columns.saturating_sub(6).clamp(1, 120);
    let address = bounded(url, width);
    let count = unicode_width::UnicodeWidthStr::width(address.as_str());
    let (top_left, top_right, bottom_left, bottom_right, horizontal, vertical) = if style.ascii {
        ("+", "+", "+", "+", "-", "|")
    } else {
        ("┌", "┐", "└", "┘", "─", "│")
    };
    let border = horizontal.repeat(count + 4);
    let lines = [
        format!("  mokly {VERSION} · comparing against {base}"),
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
            } else {
                format!("{line}\n")
            }
        })
        .collect()
}

/// Exact shortcut actions for rich watched Serve.
pub fn shortcuts() -> &'static str {
    "  o  Open the catalogue\n  r  Rebuild the catalogue\n  c  Clear the terminal\n  h  Show shortcuts\n  q  Close Serve\n  Ctrl+C  Close Serve\n"
}
