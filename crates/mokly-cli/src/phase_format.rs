//! Pure progress frame and duration formatting.

use std::time::Duration;

use mokly_cli::output::{Style, bounded};
use mokly_compare::comparison_steps::Step;

/// Format one bounded terminal progress frame.
pub(super) fn frame(style: &Style, label: &str, index: usize) -> String {
    let frames = if style.ascii {
        &["|", "/", "-", "\\"][..]
    } else {
        &["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][..]
    };
    format!(
        "\r\x1b[2K{}",
        bounded(
            &format!("  {} {label}", frames[index % frames.len()]),
            style.columns
        )
    )
}

/// Join a phase label and the words of its current comparison step.
pub(super) fn stepped(label: &str, step: Option<Step>) -> String {
    let Some(step) = step else {
        return label.into();
    };
    let words = match step {
        Step::Reading => "reading base catalogue",
        Step::Extracting => "extracting base sources",
        Step::Installing => "installing base dependencies",
        Step::Rendering => "rendering base catalogue",
        Step::Comparing => "finding changes",
    };
    format!("{label} · {words}")
}

/// Format an observed duration without changing success criteria.
pub(super) fn duration(value: Duration) -> String {
    if value.as_secs() == 0 {
        format!("{}ms", value.as_micros().saturating_add(500) / 1_000)
    } else if value.as_secs() < 60 {
        format!("{:.1}s", value.as_secs_f64())
    } else {
        format!("{}m {:02}s", value.as_secs() / 60, value.as_secs() % 60)
    }
}

/// Format one bounded successful phase or command line.
pub(super) fn success(style: &Style, text: &str) -> String {
    let glyph = if style.ascii { "+" } else { "✔" };
    let glyph = if style.color {
        format!("\x1b[32m{glyph}\x1b[0m")
    } else {
        glyph.into()
    };
    format!("{}\n", bounded(&format!("  {glyph} {text}"), style.columns))
}
