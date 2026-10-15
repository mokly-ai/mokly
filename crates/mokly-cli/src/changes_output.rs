//! Changes presentation shares the shell's entry, move, and ignored-view counts.

use mokly_compare::comparison_types::ComparisonCounts;

use crate::build::BuildChanges;
use crate::codes::Code;
use crate::output::{Mode, Style, bounded};
use crate::redaction::Redactor;

/// Rich completion line. Plain commands emit no phase lines.
pub fn ready(style: &Style, counts: ComparisonCounts) -> String {
    if style.mode == Mode::Plain {
        return String::new();
    }
    let mut parts = vec![
        format!("  {} Changes ready", if style.ascii { "+" } else { "✔" }),
        format!(
            "{} change{}",
            counts.changes,
            if counts.changes == 1 { "" } else { "s" }
        ),
    ];
    if counts.moved > 0 {
        parts.push(format!("{} moved", counts.moved));
    }
    if counts.ignored_only > 0 {
        parts.push(format!("{} ignored-only", counts.ignored_only));
    }
    format!("{}\n", bounded(&parts.join(" · "), style.columns))
}

/// Success and move diagnostics are retained with the accepted comparison only.
pub fn summary(style: &Style, changes: &BuildChanges, redactor: &Redactor) -> String {
    match changes {
        BuildChanges::Disabled => String::new(),
        BuildChanges::Unavailable { .. } if style.mode == Mode::Rich => {
            format!("{}\n", bounded("  ! Changes unavailable", style.columns))
        }
        BuildChanges::Unavailable { .. } => String::new(),
        BuildChanges::Ready(result) => {
            let mut output = String::new();
            for diagnostic in &result.pairing.diagnostics {
                let safe = redactor.safe(diagnostic);
                output.push_str(&if style.mode == Mode::Plain {
                    safe
                } else {
                    bounded(&safe, style.columns)
                });
                output.push('\n');
            }
            output + &ready(style, result.counts)
        }
    }
}

/// Base diagnostics make Changes unavailable while the head catalogue remains usable.
pub fn diagnostics(style: &Style, changes: &BuildChanges, redactor: &Redactor) -> String {
    match changes {
        BuildChanges::Unavailable { diagnostics } => diagnostics
            .iter()
            .map(|diagnostic| style.error(Code::ReviewInvalid, diagnostic, redactor))
            .collect(),
        _ => String::new(),
    }
}

#[cfg(test)]
#[path = "_tests_/changes_output_tests.rs"]
mod changes_output_tests;
