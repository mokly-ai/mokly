//! Raw output restores carriage returns without doubling existing CRLF.

use super::lines;

#[test]
fn raw_lines_keep_plain_bytes_and_normalize_newlines_once() {
    assert_eq!(lines("a\nb\r\nc\r", false), "a\nb\r\nc\r");
    assert_eq!(lines("a\nb\r\nc\r", true), "a\r\nb\r\nc\r");
}
