//! Newline coalescing, byte bounds and UTF-8 chunk boundaries.

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::log::MAX_CHUNK_BYTES;

use crate::buffer::{CliError, OutputBuffer};

#[test]
fn timer_emits_line_free_output_without_waiting_for_the_size_limit() {
    let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
    buffer.push(b"line-free progress", true);
    assert!(buffer.cut(false, false).is_empty());
    assert_eq!(buffer.cut(true, false), [b"line-free progress".to_vec()]);
    assert!(buffer.cut(false, true).is_empty());
}

#[test]
fn timer_cuts_complete_bytes_but_waits_for_an_incomplete_utf8_suffix() {
    let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
    buffer.push(b"x\xc3", true);
    assert_eq!(buffer.cut(true, false), [b"x".to_vec()]);
    assert!(buffer.cut(true, false).is_empty());
    buffer.push(b"\xa9", true);
    assert_eq!(buffer.cut(true, false), ["é".as_bytes().to_vec()]);
}

#[test]
fn invalid_utf8_run_preserves_the_diagnostic_and_drains_in_bounded_chunks() {
    let mut bytes = vec![0x80; MAX_CHUNK_BYTES + 1];
    bytes.extend_from_slice(b"\ndiagnostic after invalid bytes\n");
    let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
    buffer.push(&bytes, true);
    let mut chunks = buffer.cut(false, false);
    assert!(!chunks.is_empty());
    chunks.extend(buffer.cut(false, true));
    assert!(
        chunks
            .iter()
            .all(|chunk| !chunk.is_empty() && chunk.len() <= MAX_CHUNK_BYTES)
    );
    assert_eq!(chunks.concat(), bytes);
    assert!(buffer.cut(false, true).is_empty());
}

#[test]
fn finished_invalid_bytes_drain_completely() {
    for byte in [0x80, 0xff] {
        let bytes = vec![byte; MAX_CHUNK_BYTES * 2 + 7];
        let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
        buffer.push(&bytes, true);
        let chunks = buffer.cut(false, true);
        assert_eq!(
            chunks.iter().map(Vec::len).collect::<Vec<_>>(),
            [MAX_CHUNK_BYTES, MAX_CHUNK_BYTES, 7]
        );
        assert_eq!(chunks.concat(), bytes);
    }
}

#[test]
fn a_four_byte_character_across_the_limit_stays_in_one_chunk() {
    for prefix in 1..=3 {
        let mut bytes = vec![b'x'; MAX_CHUNK_BYTES - prefix];
        bytes.extend_from_slice("🌍".as_bytes());
        let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
        buffer.push(&bytes, true);
        let mut chunks = buffer.cut(false, false);
        assert_eq!(chunks[0].len(), MAX_CHUNK_BYTES - prefix);
        chunks.extend(buffer.cut(false, true));
        assert!(chunks.iter().all(|chunk| str::from_utf8(chunk).is_ok()));
        assert_eq!(chunks.concat(), bytes);
    }
}

#[test]
fn timer_cuts_after_the_last_complete_line_and_end_flushes_the_rest() {
    let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
    buffer.push(b"first\nsecond\nremaining", true);
    assert!(buffer.cut(false, false).is_empty());
    assert_eq!(buffer.cut(true, false), [b"first\nsecond\n".to_vec()]);
    assert_eq!(buffer.cut(false, true), [b"remaining".to_vec()]);
}

#[test]
fn size_cuts_at_the_last_newline_within_64_kib() {
    let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
    let mut bytes = b"first\n".to_vec();
    bytes.extend(vec![b'x'; MAX_CHUNK_BYTES]);
    buffer.push(&bytes, true);
    let chunks = buffer.cut(false, false);
    assert_eq!(chunks[0], b"first\n");
    assert_eq!(chunks[1].len(), MAX_CHUNK_BYTES);
}

#[test]
fn a_long_line_never_splits_a_utf8_character() {
    let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
    let bytes = "é".repeat(MAX_CHUNK_BYTES).into_bytes();
    buffer.push(&bytes, true);
    let chunks = buffer.cut(false, true);
    assert_eq!(chunks.len(), 2);
    for chunk in chunks {
        assert_eq!(chunk.len(), MAX_CHUNK_BYTES);
        assert!(str::from_utf8(&chunk).is_ok());
    }
}

#[test]
fn split_utf8_suffix_waits_for_the_next_event() {
    let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
    let mut bytes = vec![b'x'; MAX_CHUNK_BYTES - 1];
    bytes.push(0xc3);
    buffer.push(&bytes, true);
    assert_eq!(buffer.cut(false, false)[0].len(), MAX_CHUNK_BYTES - 1);
    buffer.push(&[0xa9], true);
    assert_eq!(buffer.cut(false, true), ["é".as_bytes().to_vec()]);
}

#[test]
fn cli_codes_are_plain_line_prefixes_and_the_last_code_wins() {
    let mut cli = CliError::default();
    for bytes in [b"[mokly/first] message\n[mok".as_slice(), b"ly/upload-failed] another\ntext [mokly/ignored] message\n[mokly/INVALID] message\n[mokly/unterminated] last"] { cli.push(bytes); }
    cli.finish_line();
    assert_eq!(cli.last, Some(MoklyCliCode::Unrecognized));
}

#[test]
fn split_plain_lines_parse_only_the_typed_code_at_the_start() {
    for (code, typed) in [
        ("upload-failed", MoklyCliCode::UploadFailed),
        ("git-uncommitted", MoklyCliCode::GitUncommitted),
        ("build-stale", MoklyCliCode::Unrecognized),
        ("future-code", MoklyCliCode::Unrecognized),
    ] {
        let bytes = format!("[mokly/{code}] message\n  detail [mokly/ignored] text\n");
        let mut cli = CliError::default();
        for byte in bytes.bytes() {
            cli.push(&[byte]);
        }
        cli.finish_line();
        assert_eq!(cli.last, Some(typed));
    }
}

#[test]
fn missing_or_malformed_prefixes_have_no_cli_code() {
    for line in [
        "plain stderr",
        "detail [mokly/upload-failed] message",
        "[mokly/INVALID] message",
        "[mokly/] message",
        "[mokly/upload-failed]",
        "[mokly/bad_code] message",
    ] {
        let mut cli = CliError::default();
        cli.push(line.as_bytes());
        cli.finish_line();
        assert_eq!(cli.last, None, "{line}");
    }
}

#[test]
fn malformed_utf8_prefixes_cut_at_the_limit_without_waiting() {
    for sequence in [
        b"\xc0\x80".as_slice(),
        b"\xe0\x80\x80",
        b"\xed\xa0\x80",
        b"\xf4\x90\x80\x80",
        b"\xc3x",
    ] {
        let mut bytes = vec![b'x'; MAX_CHUNK_BYTES - 1];
        bytes.extend_from_slice(sequence);
        let mut buffer = OutputBuffer::new(["token-one", "token-two"]);
        buffer.push(&bytes, true);
        let mut chunks = buffer.cut(false, false);
        assert_eq!(chunks[0].len(), MAX_CHUNK_BYTES);
        chunks.extend(buffer.cut(false, true));
        assert_eq!(chunks.concat(), bytes);
    }
}
