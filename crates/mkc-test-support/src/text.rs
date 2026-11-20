//! Text fixtures for boundary checks.

/// Produces exactly `count` newline-terminated, nonempty lines.
pub fn numbered_lines(count: usize) -> String {
    (1..=count).map(|line| format!("line {line}\n")).collect()
}

#[cfg(test)]
#[path = "_tests_/text_tests.rs"]
mod text_tests;
