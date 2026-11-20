//! Fixture builder boundaries.

use crate::text::numbered_lines;

#[test]
fn generates_exact_line_counts_including_empty() {
    for count in [0, 1, 300, 301] {
        let fixture = numbered_lines(count);
        assert_eq!(fixture.lines().count(), count);
        assert!(fixture.is_empty() || fixture.ends_with('\n'));
    }
}
