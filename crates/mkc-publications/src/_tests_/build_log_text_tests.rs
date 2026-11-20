//! Display normalization leaves safe text and never emits terminal controls.

use super::normalize;

#[test]
fn unicode_tabs_line_endings_and_invalid_utf8_follow_the_display_contract() {
    assert_eq!(
        normalize("界\ttext\r\nnext\rlast\0\u{8}".as_bytes()),
        "界\ttext\nnext\nlast"
    );
    assert_eq!(normalize(b"bad\xffbyte"), "bad\u{fffd}byte");
}

#[test]
fn csi_osc_dcs_and_simple_escapes_are_removed() {
    assert_eq!(normalize(b"\x1b[31mred\x1b[0m\x1b]8;;https://example.com\x07link\x1b]8;;\x1b\\\x1bPignored\x1b\\\x1b(0\x1b7text"), "redlinktext");
    assert_eq!(normalize(b"safe\x1b[unterminated"), "safenterminated");
    assert_eq!(normalize(b"safe\x1b]unterminated"), "safe");
}
