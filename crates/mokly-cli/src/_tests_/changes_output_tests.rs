//! Changes uses identical counts, omits zero segments, and preserves the plain contract.

use mokly_compare::comparison_types::ComparisonCounts;

use crate::changes_output::ready;
use crate::output::{Mode, Style};

#[test]
fn counts_pluralize_and_zero_segments_are_absent() {
    let mut style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 200,
    };
    assert_eq!(
        ready(&style, ComparisonCounts::default()),
        "  ✔ Changes ready · 0 changes\n"
    );
    let counts = ComparisonCounts {
        changes: 1,
        moved: 1,
        ignored_only: 2,
    };
    assert_eq!(
        ready(&style, counts),
        "  ✔ Changes ready · 1 change · 1 moved · 2 ignored-only\n"
    );
    style.mode = Mode::Plain;
    assert_eq!(ready(&style, counts), "");
}
