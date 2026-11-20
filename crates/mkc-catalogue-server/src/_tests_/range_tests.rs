//! Single-range syntax, clamping and satisfiability boundaries.

#![allow(clippy::unwrap_used)]

use mkc_file_store_interface::stream::ByteRange;

use super::{Selection, select};

#[test]
fn closed_open_and_suffix_ranges_select_inclusive_offsets() {
    for (value, length, start, end) in [
        ("bytes=0-0", 1, 0, 0),
        ("bytes=2-4", 10, 2, 4),
        ("bytes=2-99", 10, 2, 9),
        ("bytes=4-", 10, 4, 9),
        ("bytes=-3", 10, 7, 9),
        ("bytes=-10", 10, 0, 9),
        ("bytes=-99", 10, 0, 9),
        ("bytes=-18446744073709551615", 10, 0, 9),
        ("bytes=0002-0004", 10, 2, 4),
    ] {
        assert_eq!(
            select(value, length),
            Selection::Partial(ByteRange::new(start, end, length).unwrap()),
            "{value} against {length} bytes"
        );
    }
}

#[test]
fn syntactically_valid_ranges_can_be_unsatisfiable() {
    for (value, length) in [
        ("bytes=0-0", 0),
        ("bytes=0-", 0),
        ("bytes=-1", 0),
        ("bytes=5-4", 10),
        ("bytes=10-10", 10),
        ("bytes=11-", 10),
        ("bytes=-0", 10),
    ] {
        assert_eq!(
            select(value, length),
            Selection::Unsatisfiable,
            "{value} against {length} bytes"
        );
    }
}

#[test]
fn multiple_unparseable_overflowing_and_unknown_ranges_are_ignored() {
    for value in [
        "",
        "bytes",
        "bytes=",
        "bytes=-",
        "bytes=0",
        "bytes=0-1,2-3",
        "bytes=0-1,",
        "items=0-1",
        "Bytes=0-1",
        " bytes=0-1",
        "bytes=0-1 ",
        "bytes= 0-1",
        "bytes=0 -1",
        "bytes=0- 1",
        "bytes=+0-1",
        "bytes=0.0-1",
        "bytes=--1",
        "bytes=0-1-2",
        "bytes=18446744073709551616-",
        "bytes=0-18446744073709551616",
        "bytes=-18446744073709551616",
    ] {
        assert_eq!(select(value, 10), Selection::Full, "{value}");
    }
}
