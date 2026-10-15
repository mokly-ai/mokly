//! Optional ASCII whitespace in substitutions preserves names and source offsets.

use crate::references::substitutions;

#[test]
fn substitutions_trim_ascii_whitespace_around_names() {
    assert_eq!(
        substitutions("{{ name }} / {{\tbadge.count\n}}"),
        [(0, "name"), (13, "badge.count")],
    );
    assert_eq!(substitutions("{{ \t\n\r\u{000c}name\t }}"), [(0, "name")]);
}

#[test]
fn substitution_spacing_does_not_change_the_name_grammar_or_unclosed_text() {
    assert_eq!(substitutions("{{ badge .count }}"), [(0, "badge .count")]);
    assert_eq!(
        substitutions("{{\u{a0}name\u{a0}}}"),
        [(0, "\u{a0}name\u{a0}")]
    );
    assert!(substitutions("ordinary {{ name").is_empty());
}
