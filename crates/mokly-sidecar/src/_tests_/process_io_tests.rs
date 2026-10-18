//! Split UTF-8, line order, bounded carry, and EOF forwarding use fake input.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::workers::DiagnosticsMock;

use super::{DiagnosticInputMock, forward_diagnostics};

#[test]
fn only_enabled_complete_sidecar_records_bypass_diagnostic_formatting() {
    const LINE: &str = "[mokly:timing] { \"schemaVersion\":1, \"role\":\"sidecar\", \"session\":\"separate\", \"pid\":123, \"stage\":\"sidecar.bundle\", \"event\":\"start\", \"id\":1, \"elapsedMs\":0 }";
    for enabled in [false, true] {
        let bytes = format!("{LINE}\nordinary\n[mokly:timing] invalid\n").into_bytes();
        let mut reader = Unimock::new((
            DiagnosticInputMock::read
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, output| {
                    output[..bytes.len()].copy_from_slice(&bytes);
                    Ok(bytes.len())
                })),
            DiagnosticInputMock::read
                .next_call(matching!(_))
                .returns(Ok(0)),
        ));
        let rest = (
            DiagnosticsMock::emit
                .next_call(matching!("ordinary"))
                .returns(()),
            DiagnosticsMock::emit
                .next_call(matching!("[mokly:timing] invalid"))
                .returns(()),
        );
        let diagnostics = if enabled {
            Unimock::new((
                DiagnosticsMock::timing
                    .next_call(matching!((text) if *text == LINE))
                    .returns(()),
                rest,
            ))
        } else {
            Unimock::new((
                DiagnosticsMock::emit
                    .next_call(matching!((text) if *text == LINE))
                    .returns(()),
                rest,
            ))
        };
        forward_diagnostics(&mut reader, &diagnostics, enabled);
    }
}

#[test]
fn a_newline_after_the_chunk_limit_cannot_emit_an_oversized_piece() {
    let mut reader = Unimock::new((
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output.fill(b'x');
                Ok(output.len())
            })
            .n_times(16),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output[..2].copy_from_slice(b"x\n");
                Ok(2)
            }),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .returns(Ok(0)),
    ));
    let diagnostics = Unimock::new((
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.len() == 65_536))
            .returns(()),
        DiagnosticsMock::emit.next_call(matching!("x")).returns(()),
    ));
    forward_diagnostics(&mut reader, &diagnostics, false);
}

#[test]
fn diagnostic_lines_preserve_split_utf8_and_flush_the_eof_tail() {
    const FIRST: &[u8] = b"first\n\xe2";
    const SECOND: &[u8] = b"\x82\xacuro\nlast";
    let mut reader = Unimock::new((
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output[..FIRST.len()].copy_from_slice(FIRST);
                Ok(FIRST.len())
            }),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output[..SECOND.len()].copy_from_slice(SECOND);
                Ok(SECOND.len())
            }),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .returns(Ok(0)),
    ));
    let diagnostics = Unimock::new((
        DiagnosticsMock::emit
            .next_call(matching!("first"))
            .returns(()),
        DiagnosticsMock::emit
            .next_call(matching!("€uro"))
            .returns(()),
        DiagnosticsMock::emit
            .next_call(matching!("last"))
            .returns(()),
    ));
    forward_diagnostics(&mut reader, &diagnostics, false);
}

#[test]
fn long_lines_keep_a_bounded_carry_without_losing_bytes() {
    let mut reader = Unimock::new((
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output.fill(b'x');
                Ok(output.len())
            })
            .n_times(17),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .returns(Ok(0)),
    ));
    let diagnostics = Unimock::new((
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.len() == 65_536 && text.bytes().all(|b| b == b'x')))
            .returns(()),
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.len() == 4096 && text.bytes().all(|b| b == b'x')))
            .returns(()),
    ));
    forward_diagnostics(&mut reader, &diagnostics, false);
}

#[test]
fn invalid_utf8_cannot_underflow_the_bounded_buffer_split() {
    let mut reader = Unimock::new((
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .answers(&|_, output| {
                output.fill(0x80);
                Ok(output.len())
            })
            .n_times(17),
        DiagnosticInputMock::read
            .next_call(matching!(_))
            .returns(Ok(0)),
    ));
    let diagnostics = Unimock::new((
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.chars().count() == 65_536))
            .returns(()),
        DiagnosticsMock::emit
            .next_call(matching!((text) if text.chars().count() == 4096))
            .returns(()),
    ));
    forward_diagnostics(&mut reader, &diagnostics, false);
}

#[test]
fn every_utf8_width_and_crossing_position_stays_whole_at_the_chunk_bound() {
    for character in ["é", "€", "😀"] {
        for crossing in 1..character.len() {
            let prefix = "x".repeat(65_536 - crossing);
            let original = format!("{prefix}{character}tail");
            let chunks = Mutex::new(
                original
                    .as_bytes()
                    .chunks(4096)
                    .map(Vec::from)
                    .collect::<VecDeque<_>>(),
            );
            let mut input = Unimock::new(
                DiagnosticInputMock::read
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, output| {
                        let Some(bytes) = chunks.lock().unwrap().pop_front() else {
                            return Ok(0);
                        };
                        output[..bytes.len()].copy_from_slice(&bytes);
                        Ok(bytes.len())
                    })),
            );
            let pieces = Arc::new(Mutex::new(Vec::new()));
            let captured = pieces.clone();
            let diagnostics = Unimock::new(
                DiagnosticsMock::emit
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, text| {
                        captured.lock().unwrap().push(text.to_owned())
                    })),
            );
            forward_diagnostics(&mut input, &diagnostics, false);
            let pieces = pieces.lock().unwrap();
            assert_eq!(*pieces, [prefix, format!("{character}tail")]);
            assert!(pieces.iter().all(|piece| piece.len() <= 65_536));
            assert_eq!(pieces.concat(), original);
        }
    }
}
